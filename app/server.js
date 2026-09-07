const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configurazione Database SQLite (crea un file database.sqlite locale)
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Errore nell\'apertura del database', err.message);
  } else {
    console.log('Connesso al database SQLite.');
    // Crea la tabella dei task se non esiste già
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL
    )`);
  }
});

// Funzione di utilità per recuperare tutti i task
function getTasks(callback) {
  db.all(`SELECT * FROM tasks`, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      callback([]);
    } else {
      callback(rows);
    }
  });
}

io.on('connection', (socket) => {
  console.log('Un utente si è connesso:', socket.id);

  // Invia i task salvati sul DB appena un client si collega
  getTasks((tasks) => {
    socket.emit('init_tasks', tasks);
  });

  // Quando un utente aggiunge o sposta un task
  socket.on('update_task', (updatedTasks) => {
    // Svuota la tabella e reinserisci lo stato aggiornato (approccio semplice per la Kanban)
    db.serialize(() => {
      db.run(`DELETE FROM tasks`, (err) => {
        if (err) console.error(err.message);
      });

      const stmt = db.prepare(`INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)`);
      updatedTasks.forEach(task => {
        stmt.run(task.id, task.title, task.status);
      });
      stmt.finalize();
    });

    // Rimanda i task aggiornati a tutti i client
    io.emit('tasks_updated', updatedTasks);
  });

  socket.on('disconnect', () => {
    console.log('Utente disconnesso:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server in ascolto sulla porta 3000');
});