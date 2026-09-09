import { randomUUID } from 'node:crypto';
import { fail, transaction } from './security.mjs';
export function onlineRoutes(app, { db, user, write, limit }) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const publicMatch = (match, id) => ({ ...match, symbol: match.x === id ? 'X' : 'O' });
  function expire() { run("UPDATE matches SET state='expired',updated=? WHERE state IN ('waiting','playing') AND updated<?", Date.now(), Date.now()-30*60*1000); }
  app.get('/api/online/match', user(), (req,res) => {
    expire();
    const match = one("SELECT * FROM matches WHERE (x=? OR o=?) ORDER BY created DESC LIMIT 1", req.user.id,req.user.id);
    res.json({ match: match ? publicMatch(match,req.user.id) : null });
  });
  app.post('/api/online/join', limit, user(), write, (req,res) => {
    expire();
    const match = transaction(db, () => {
      const current = one("SELECT * FROM matches WHERE (x=? OR o=?) AND state IN ('waiting','playing')",req.user.id,req.user.id);
      if (current) return current;
      const waiting = one("SELECT * FROM matches WHERE state='waiting' AND x<>? ORDER BY created LIMIT 1",req.user.id);
      if (waiting) {
        run("UPDATE matches SET o=?,state='playing',updated=? WHERE id=?",req.user.id,Date.now(),waiting.id);
        return one('SELECT * FROM matches WHERE id=?',waiting.id);
      }
      const id=randomUUID();
      run('INSERT INTO matches(id,x,created,updated) VALUES(?,?,?,?)',id,req.user.id,Date.now(),Date.now());
      return one('SELECT * FROM matches WHERE id=?',id);
    });
    res.json({ match: publicMatch(match,req.user.id) });
  });
  app.post('/api/online/move', limit, user(), write, (req,res) => {
    expire();
    const result = transaction(db, () => {
      const m=one('SELECT * FROM matches WHERE id=?',String(req.body.matchId));
      if (!m || ![m.x,m.o].includes(req.user.id)) fail(404,'Match not found.');
      if (m.state!=='playing' || m.revision!==req.body.revision) fail(409,'Match changed. Refresh before moving.');
      const symbol=m.x===req.user.id?'X':'O';
      const cell=req.body.cell;
      if (m.turn!==symbol || !Number.isInteger(cell) || cell<0 || cell>8 || m.board[cell]!=='-') fail(400,'That move is not allowed.');
      const board=m.board.split(''); board[cell]=symbol;
      const won=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(line=>line.every(i=>board[i]===symbol));
      const state=won?'won':board.includes('-')?'playing':'draw';
      run('UPDATE matches SET board=?,turn=?,state=?,winner=?,revision=revision+1,updated=? WHERE id=?',board.join(''),symbol==='X'?'O':'X',state,won?req.user.id:null,Date.now(),m.id);
      return one('SELECT * FROM matches WHERE id=?',m.id);
    });
    res.json({ match: publicMatch(result,req.user.id) });
  });
  app.post('/api/online/leave', user(), write, (req,res) => {
    const m=one('SELECT * FROM matches WHERE id=?',String(req.body.matchId));
    if (!m || ![m.x,m.o].includes(req.user.id)) fail(404,'Match not found.');
    if (['playing','waiting'].includes(m.state)) run("UPDATE matches SET state='cancelled',updated=? WHERE id=?",Date.now(),m.id);
    res.json({ ok:true });
  });
  app.get('/api/online/leaderboard', (req,res) => {
    res.json({ scores:db.prepare("SELECT u.name,count(*) AS wins FROM matches m JOIN users u ON m.winner=u.id WHERE m.state='won' AND u.suspended=0 GROUP BY u.id ORDER BY wins DESC,u.name LIMIT 20").all() });
  });
}
