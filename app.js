const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { exec } = require('child_process');
const cors = require('cors')
const qrcode = require('qrcode');
require('dotenv').config()

const app = express();

app.use(cors())

const port = process.env.PORT || 3000;

let qrCodeImage = null; // Store the base64 QR code
let isClientAuthenticated = false;
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const ALLOWED_PHONE_NUMBERS = process.env.ALLOWED_PHONE_NUMBERS || '';

// Initialize the WhatsApp client
let client = new Client({
    authStrategy: new LocalAuth(),
});

// Generate QR code and save it as base64 when needed
client.on('qr', async (qr) => {
    try {
        qrCodeImage = await qrcode.toDataURL(qr); // Convert QR to base64
        console.log("QR code generated and stored.");
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
});

// Log when the client is ready to send messages
client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    qrCodeImage = null; // Clear QR code since client is now ready
});

client.on('authenticated', () => {
    console.log('Authenticated!');
    isClientAuthenticated = true; // Set client as authenticated
    qrCodeImage = null; // Clear QR code since client is authenticated
})

client.on('disconnected', () => {
    console.log('Disconnected!');
    isClientAuthenticated = false; // Set client as authenticated
    qrCodeImage = null; // Clear QR code since client is authenticated
})

client.on('auth_failure', () => {
    console.log('Auth Failure!');
    isClientAuthenticated = false; // Set client as authenticated
    qrCodeImage = null; // Clear QR code since client is authenticated
})

client.on('message_create', message => {
	if (message.body.toLowerCase() === 'p') {
		// send back "pong" to the chat the message was sent in
		client.sendMessage(message.from, 'Status Active');
	}
});

// Initialize the WhatsApp client
client.initialize();

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
            </head>
            <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <h1>WhatsApp QR Code</h1>
                <p>This is a simple server that generates a QR code for you to scan with your WhatsApp client.</p>
                <p>To use this server, you need to have a WhatsApp client installed on your device.</p>
                <p>Once you have the QR code scanned, you can send a message to the server using the <code>/send-message</code> endpoint.</p>
                <p>For example, to send a message to <code>+6281234567***</code>, you can use the following command:</p>
                <pre>curl -X GET ${process.env.BASE_URL || 'http://localhost:8080'}/send-message?phoneNumber=6281234567***&message=Hello%20from%20the%20server</pre>
                <p>You can also use the <code>P</code> command to check the server status.</p>
                <p style="font-weight: bold">Current Status: <span style="${isClientAuthenticated ? 'color: green;' : 'color: red;'}}">${isClientAuthenticated ? 'Authenticated' : 'Not Authenticated'}</span></p>
            </body>
        </html>
    `);
});

// Endpoint to get the QR code as a base64 image
app.get('/qr', (req, res) => {
    if (qrCodeImage) {
        res.send(`
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                </head>
                <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                    <h1>Scan QR Code to Login</h1>
                    <img src="${qrCodeImage}" alt="QR Code" style="width: 300px; height: 300px;"/>
                    <p>Open WhatsApp on your phone and scan this code to login.</p>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                </head>
                <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                    <h1>QR Code Not Available</h1>
                    <p>Please wait for the QR code to be generated, or refresh if the client is not ready yet.</p>
                </body>
            </html>
        `);
    }
});

// Endpoint to send a WhatsApp message
app.get('/send-message', async (req, res) => {
    const { phoneNumber, message } = req.query;

    // Validate input
    if (!phoneNumber || !message) {
        return res.status(200).json({ success: true, error: 'Phone number and message are required' });
    }

    // WhatsApp ID format is <number>@c.us
    const chatId = `${phoneNumber}@c.us`;

    if(ENVIRONMENT === 'development' && !ALLOWED_PHONE_NUMBERS.split(',').includes(phoneNumber)) {
        return res.status(200).json({ success: true, error: 'Phone number is not allowed' });
    }

    try {
        // Send the message using the WhatsApp client
        await client.sendMessage(chatId, message);
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(200).json({ success: false, error: 'Failed to send message' });
    }
});

app.get('/disconnect', async (req, res) => {
    await client.logout();
    await client.destroy();

    res.status(200).json({ success: true, message: 'Client disconnected successfully' });

    exec('rm -rf .wwebjs_*', (err, stdout, stderr) => {
        if (err) {
            console.error('Error during cleanup:', stderr);
        } else {
            console.log('Cleanup completed:', stdout);
        }

        process.exit(1);
    });
    process.exit(0);
})

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
