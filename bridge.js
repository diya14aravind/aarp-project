const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const { Server } = require('socket.io');

// CONFIGURATION
const BAUD_RATE = 115200;
const HTTP_PORT = 3001; 
const MOCK_MODE = process.argv.includes('--mock');

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

let activePort = null;

async function listPorts() {
  const ports = await SerialPort.list();
  console.log('\n--- Available Serial Ports ---');
  ports.forEach((port, i) => {
    console.log(`${i}: ${port.path}\t${port.manufacturer || 'Unknown'}`);
  });
  return ports;
}

async function startBridge() {
  if (MOCK_MODE) {
    console.log('\n--- STARTING IN MOCK MODE ---');
    setInterval(() => {
      const mockData = {
        bpm: 70 + Math.floor(Math.random() * 20),
        temp: 24 + Math.random() * 5,
        hum: 45 + Math.random() * 10,
        lat: 12.9716 + (Math.random() - 0.5) * 0.01,
        lng: 77.5946 + (Math.random() - 0.5) * 0.01,
        sats: 8,
        ts: Date.now()
      };
      io.emit('sensor-data', mockData);
    }, 1000);
    return;
  }

  const ports = await listPorts();
  if (ports.length === 0) {
    console.error('No serial ports found! Please connect your Arduino.');
    // Keep checking every 5 seconds
    setTimeout(startBridge, 5000);
    return;
  }

  // Auto-detect Arduino or pick the first one
  const arduinoPort = ports.find(p => p.manufacturer?.toLowerCase().includes('arduino')) || ports[0];
  console.log(`\nConnecting to: ${arduinoPort.path} at ${BAUD_RATE} baud...`);

  const port = new SerialPort({
    path: arduinoPort.path,
    baudRate: BAUD_RATE,
    autoOpen: false
  });

  port.open((err) => {
    if (err) {
      console.error(`Error opening port: ${err.message}`);
      setTimeout(startBridge, 5000);
      return;
    }
    console.log('Port opened successfully!');
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  parser.on('data', (data) => {
    try {
      const jsonData = JSON.parse(data);
      console.log('Relaying Data:', jsonData);
      io.emit('sensor-data', jsonData);
    } catch (e) {
      console.log('Serial Raw:', data);
    }
  });

  port.on('close', () => {
    console.log('Port closed. Attempting reconnect...');
    setTimeout(startBridge, 5000);
  });

  activePort = port;
}

io.on('connection', (socket) => {
  console.log('Frontend connected to Bridge');
  socket.on('disconnect', () => {
    console.log('Frontend disconnected');
  });
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`Bridge Server running on http://localhost:${HTTP_PORT}`);
  startBridge();
});

// Graceful shutdown
process.on('SIGINT', () => {
  if (activePort && activePort.isOpen) {
    activePort.close();
  }
  process.exit();
});
