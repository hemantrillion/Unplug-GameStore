package online.hekugo.unplug.player;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.graphics.Color;
import android.util.AtomicFile;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native verified download store. Game WebViews have no JavaScript/native bridge. */
public class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout content;
    private TextView status;
    private String origin;
    private JSONArray catalog = new JSONArray();
    private JSONObject publicKey;
    private WebView gameView;
    private boolean downloadedTab;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        origin = getPreferences(MODE_PRIVATE).getString("origin", "");
        showHome();
        if (!origin.isEmpty()) refresh();
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private TextView label(String value, int size) {
        TextView text = new TextView(this); text.setText(value); text.setTextSize(size);
        text.setTextColor(Color.rgb(37,44,58)); text.setPadding(0,dp(8),0,dp(8)); return text;
    }
    private Button button(String value, Runnable action) {
        Button b = new Button(this); b.setText(value); b.setAllCaps(false);
        b.setOnClickListener(v -> action.run()); return b;
    }
    private void showHome() {
        closeGame();
        ScrollView scroll = new ScrollView(this);
        LinearLayout outer = new LinearLayout(this); outer.setOrientation(LinearLayout.VERTICAL);
        outer.setPadding(dp(24),dp(28),dp(24),dp(24)); outer.setBackgroundColor(Color.rgb(246,245,241));
        outer.addView(label("unplug.",36)); outer.addView(label("A little room to play.",24));
        outer.addView(label("Download once. Play offline. Your next good break starts here.",15));
        LinearLayout tabs = new LinearLayout(this);
        tabs.addView(button("Discover",() -> {downloadedTab=false;render();}));
        tabs.addView(button("Downloads",() -> {downloadedTab=true;render();})); outer.addView(tabs);
        status=label(origin.isEmpty()?"Connect to an HTTPS UNPLUG service to discover games.":"Service: "+origin,12); outer.addView(status);
        outer.addView(button("Connect / change service",this::configure));
        outer.addView(button("Refresh catalog",this::refresh));
        content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);outer.addView(content);
        scroll.addView(outer);setContentView(scroll);render();
    }
    private void configure() {
        EditText input=new EditText(this);input.setSingleLine(true);input.setText(origin);input.setHint("https://your-unplug-service.example");
        new AlertDialog.Builder(this).setTitle("UNPLUG service").setView(input).setNegativeButton("Cancel",null)
            .setPositiveButton("Connect",(dialog,which)->{
                try {
                    URI uri=new URI(input.getText().toString().trim());
                    if (!"https".equals(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null || (uri.getPath()!=null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))) throw new Exception("Enter an HTTPS origin without a path or credentials.");
                    origin="https://"+uri.getRawAuthority();getPreferences(MODE_PRIVATE).edit().putString("origin",origin).apply();catalog=new JSONArray();publicKey=null;refresh();
                } catch(Exception error){status.setText(error.getMessage());}
            }).show();
    }
    private JSONObject request(String endpoint) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URI(origin+endpoint).toURL().openConnection();
        connection.setConnectTimeout(8000);connection.setReadTimeout(12000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept","application/json");
        try {
            if(connection.getResponseCode()!=200)throw new Exception("Service returned HTTP "+connection.getResponseCode());
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
            try(var stream=connection.getInputStream()){while((n=stream.read(buffer))!=-1){if(bytes.size()+n>2*1024*1024)throw new Exception("Response exceeds download limit.");bytes.write(buffer,0,n);}}
            return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
        } finally {connection.disconnect();}
    }
    private void refresh() {
        if(origin.isEmpty()){configure();return;}status.setText("Refreshing the live catalog…");
        worker.execute(()->{try{
            JSONObject config=request("/api/config"),response=request("/api/catalog");
            JSONObject key=config.getJSONObject("publicKey");JSONArray games=response.getJSONArray("games");
            runOnUiThread(()->{publicKey=key;catalog=games;status.setText("Connected · "+games.length()+" approved games");render();});
        }catch(Exception error){runOnUiThread(()->status.setText("Offline or unavailable. Downloaded games are still ready. "+error.getMessage()));}});
    }
    private File directory(){File dir=new File(getFilesDir(),"verified-games");if(!dir.exists())dir.mkdirs();return dir;}
    private File gameFile(String id) throws Exception {if(!id.matches("[a-f0-9-]{36}"))throw new Exception("Invalid release identifier.");return new File(directory(),id+".json");}
    private void render() {
        if(content==null)return;content.removeAllViews();
        if(downloadedTab){
            File[] files=directory().listFiles((dir,name)->name.endsWith(".json"));
            if(files==null||files.length==0){content.addView(label("Your offline collection is waiting for its first game.",16));return;}
            for(File file:files){try{
                JSONObject saved=new JSONObject(new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8));JSONObject game=saved.getJSONObject("game");
                content.addView(label(game.getString("title")+" · "+game.getString("version"),20));
                content.addView(button("Play offline",()->play(saved)));
                content.addView(button("Remove download",()->new AlertDialog.Builder(this).setMessage("Remove this release from the device?").setNegativeButton("Cancel",null).setPositiveButton("Remove",(d,w)->{if(!file.delete())status.setText("Unable to remove download.");render();}).show()));
            }catch(Exception error){content.addView(label("A saved release is unreadable. Remove app data or download it again.",14));}}
        }else{
            if(catalog.length()==0)content.addView(label("No live games yet. An administrator must approve and activate a release.",16));
            for(int i=0;i<catalog.length();i++){try{
                JSONObject game=catalog.getJSONObject(i);content.addView(label(game.getString("title"),22));
                content.addView(label(game.getString("description"),14));content.addView(label(game.getString("version")+" · "+game.getString("category"),12));
                content.addView(button("Download verified release",()->download(game)));
            }catch(Exception error){status.setText("Invalid catalog entry.");}}
        }
    }
    private void download(JSONObject game) {
        if(publicKey==null){status.setText("Refresh the service configuration first.");return;}
        final JSONObject key=publicKey;status.setText("Downloading and verifying…");
        worker.execute(()->{try{
            String id=game.getString("release_id");gameFile(id);
            JSONObject artifact=request("/api/artifacts/"+id);
            if(!artifact.getString("sha256").equals(game.getString("sha256")))throw new Exception("Catalog digest changed. Refresh and retry.");
            verifyArtifact(artifact,key);
            JSONObject saved=new JSONObject().put("game",game).put("artifact",artifact).put("key",key);
            AtomicFile file=new AtomicFile(gameFile(id));FileOutputStream output=null;
            try{output=file.startWrite();output.write(saved.toString().getBytes(StandardCharsets.UTF_8));file.finishWrite(output);}catch(Exception error){if(output!=null)file.failWrite(output);throw error;}
            runOnUiThread(()->{status.setText("Downloaded and verified. Ready after restart, even offline.");downloadedTab=true;render();});
        }catch(Exception error){runOnUiThread(()->status.setText("Download not saved: "+error.getMessage()));}});
    }
    private byte[] decode(String value){return Base64.decode(value,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
    private void verifyArtifact(JSONObject artifact,JSONObject jwk) throws Exception {
        byte[] bytes=artifact.getString("html").getBytes(StandardCharsets.UTF_8);
        if(bytes.length>256*1024)throw new Exception("Game exceeds 256 KiB.");
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder hex=new StringBuilder();for(byte b:hash)hex.append(String.format("%02x",b&255));
        if(!hex.toString().equals(artifact.getString("sha256")))throw new Exception("Artifact checksum mismatch.");
        if(!"EC".equals(jwk.getString("kty"))||!"P-256".equals(jwk.getString("crv")))throw new Exception("Unsupported release key.");
        AlgorithmParameters parameters=AlgorithmParameters.getInstance("EC");parameters.init(new ECGenParameterSpec("secp256r1"));
        ECPoint point=new ECPoint(new BigInteger(1,decode(jwk.getString("x"))),new BigInteger(1,decode(jwk.getString("y"))));
        var key=KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point,parameters.getParameterSpec(ECParameterSpec.class)));
        byte[] raw=Base64.decode(artifact.getString("signature"),Base64.DEFAULT);if(raw.length!=64)throw new Exception("Invalid signature length.");
        byte[] r=new BigInteger(1,java.util.Arrays.copyOfRange(raw,0,32)).toByteArray(),s=new BigInteger(1,java.util.Arrays.copyOfRange(raw,32,64)).toByteArray();
        ByteArrayOutputStream der=new ByteArrayOutputStream();der.write(0x30);der.write(4+r.length+s.length);der.write(2);der.write(r.length);der.write(r);der.write(2);der.write(s.length);der.write(s);
        Signature verifier=Signature.getInstance("SHA256withECDSA");verifier.initVerify(key);verifier.update(bytes);if(!verifier.verify(der.toByteArray()))throw new Exception("Release signature mismatch.");
    }
    private void play(JSONObject saved) {
        worker.execute(()->{try{
            JSONObject artifact=saved.getJSONObject("artifact");verifyArtifact(artifact,saved.getJSONObject("key"));String html=artifact.getString("html");
            runOnUiThread(()->{
                LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.addView(button("← Back to downloads",this::showHome));
                gameView=new WebView(this);WebSettings settings=gameView.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setBlockNetworkLoads(true);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
                gameView.setWebViewClient(new WebViewClient(){
                    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
                    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
                });
                String csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">";
                String secured=html.replaceFirst("(?i)<head(?:\\s[^>]*)?>","<head>"+csp);
                layout.addView(gameView,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
                gameView.loadDataWithBaseURL("https://unplug-game.invalid/",secured,"text/html","UTF-8",null);
            });
        }catch(Exception error){runOnUiThread(()->status.setText("This game cannot run: "+error.getMessage()));}});
    }
    private void closeGame(){if(gameView!=null){gameView.stopLoading();gameView.loadUrl("about:blank");gameView.destroy();gameView=null;}}
    @Override public void onBackPressed(){if(gameView!=null){showHome();}else super.onBackPressed();}
    @Override protected void onPause(){if(gameView!=null)gameView.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(gameView!=null)gameView.onResume();}
    @Override protected void onDestroy(){closeGame();worker.shutdownNow();super.onDestroy();}
}
