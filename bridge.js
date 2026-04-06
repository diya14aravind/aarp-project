const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const { Server } = require('socket.io');

const BAUD_RATE = 115200;
const HTTP_PORT = 3002; 
const MOCK_MODE = process.argv.includes('--mock');

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let activePort = null;
let emergencyTimerId = null;
let emergencyActive = false;

async function listPorts() {
  const ports = await SerialPort.list();
  console.log('\n--- Available Serial Ports ---');
  ports.forEach((port, i) => {
    console.log(`${i}: ${port.path}\t${port.manufacturer || 'Unknown'}`);
  });
  return ports;
}

// Handle global client acknowledge
io.on('connection', (socket) => {
  console.log('Frontend connected to Bridge');
  
  socket.on('acknowledge', () => {
    console.log("!!! ALARM ACKNOWLEDGED BY USER. RESET SENT TO HARDWARE. !!!");
    emergencyActive = false;
    if (emergencyTimerId) {
      clearTimeout(emergencyTimerId);
      emergencyTimerId = null;
    }
    io.emit('emergency-cancelled');
    
    if (activePort && activePort.isOpen) {
      activePort.write('R'); // Send Reset to Arduino
    }
  });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected');
  });
});

async function startBridge() {
  if (MOCK_MODE) {
    console.log('\n--- STARTING IN MOCK MODE ---');
    let mockEmergency = false;
    let mockBpm = 75;

    setInterval(() => {
      // Simulate random fall/emergency after 10 seconds for testing
      if (Math.random() < 0.05 && !mockEmergency) {
        mockEmergency = true;
        mockBpm = 160; 
      }

      const mockData = {
        bpm: mockBpm + Math.floor(Math.random() * 5),
        temp: 24 + Math.random() * 2,
        hum: 45 + Math.random() * 5,
        lat: 12.9716 + (Math.random() - 0.5) * 0.01,
        lng: 77.5946 + (Math.random() - 0.5) * 0.01,
        sats: 8,
        fall: mockEmergency,
        emergency: mockEmergency,
        ts: Date.now()
      };
      
      handleIncomingData(mockData);
      
    }, 1000);
    return;
  }

  const ports = await listPorts();
  if (ports.length === 0) {
    console.error('No serial ports found! Please connect your Arduino.');
    setTimeout(startBridge, 5000);
    return;
  }

  const arduinoPort = ports.find(p => p.manufacturer?.toLowerCase().includes('arduino')) || ports[0];
  console.log(`\nConnecting to: ${arduinoPort.path} at ${BAUD_RATE} baud...`);

  const port = new SerialPort({ path: arduinoPort.path, baudRate: BAUD_RATE, autoOpen: false });

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
      handleIncomingData(jsonData);
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

function handleIncomingData(jsonData) {
  io.emit('sensor-data', jsonData);
      
  // Emergency Protocol Logic
  if (jsonData.emergency && !emergencyActive) {
      emergencyActive = true;
      const reason = jsonData.fall ? "FALL DETECTED" : "CRITICAL VITALS (BPM ANOMALY)";
      console.log(`\n[ALERT] ${reason} - STARTING 2 MINUTE BUZZER TIMER`);
      
      io.emit('emergency-start', { reason });
      
      // Start 2 MINUTE (120,000ms) Dispatch Timer
      emergencyTimerId = setTimeout(() => {
          console.log("\n!!! 2 MINUTE TIMEOUT REACHED !!!");
          console.log("!!! DISPATCHING EMERGENCY AUTHORITIES AND HOSPITAL !!!");
          // In a real app, you would hit a Twilio API or Webhook here
          io.emit('emergency-dispatch');
      }, 120000); 
  } else if (!jsonData.emergency && emergencyActive) {
      // Hardware cleared the emergency locally
      emergencyActive = false;
      if (emergencyTimerId) clearTimeout(emergencyTimerId);
      io.emit('emergency-cancelled');
  }
}

httpServer.listen(HTTP_PORT, () => {
  console.log(`Bridge Server running on http://localhost:${HTTP_PORT}`);
  startBridge();
});
