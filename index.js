import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

// In-memory conversation history store
// Key: remoteJid, Value: Array of message objects for Gemini: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
const conversations = new Map();

// Helper to limit history size (max 20 messages)
const MAX_HISTORY = 20;

function cleanHistory(history) {
  if (history.length > MAX_HISTORY) {
    // Keep history even-numbered to maintain user-model pairs if possible, but keeping the latest messages
    return history.slice(history.length - MAX_HISTORY);
  }
  return history;
}

// Extract text content from message object
function getMessageText(message) {
  if (!message) return null;
  if (typeof message === 'string') return message;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage && message.extendedTextMessage.text) {
    return message.extendedTextMessage.text;
  }
  if (message.imageMessage && message.imageMessage.caption) {
    return message.imageMessage.caption;
  }
  if (message.videoMessage && message.videoMessage.caption) {
    return message.videoMessage.caption;
  }
  return null;
}

// Generate response from Gemini API
async function generateResponse(prompt, history, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use gemini-2.5-flash as requested by the user
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are a helpful and polite WhatsApp chatbot. Keep your answers concise, direct, and easy to read on mobile devices.'
  });

  const chat = model.startChat({
    history: history
  });

  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

// Get response with fallback logic
async function getGeminiReply(prompt, history) {
  try {
    console.log('Attempting call with Primary Gemini API Key...');
    return await generateResponse(prompt, history, process.env.GEMINI_PRIMARY_KEY);
  } catch (error) {
    console.warn('Primary Gemini Key failed:', error.message || error);
    console.log('Falling back to Fallback Gemini API Key...');
    return await generateResponse(prompt, history, process.env.GEMINI_FALLBACK_KEY);
  }
}

// Send message via Evolution API
async function sendWhatsAppMessage(recipientJid, text) {
  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number: recipientJid,
      text: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Evolution API send failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// Webhook endpoint
app.post('/webhook', async (res, responseObj) => {
  // Evolution API sends webhook data, sometimes wrapped, sometimes direct.
  // We handle both options.
  const payload = res.body;

  // Immediately respond with 200 OK to the webhook sender to avoid timeout retries
  responseObj.sendStatus(200);

  try {
    // Log basic event info
    const event = payload.event;
    console.log(`Received webhook event: ${event}`);

    // We are interested in new messages: "messages.upsert" or "MESSAGES_UPSERT"
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return;
    }

    const data = payload.data;
    if (!data) return;

    const key = data.key;
    if (!key) return;

    // Avoid infinite loops by ignoring messages sent by the bot itself
    if (key.fromMe) {
      console.log('Ignoring outgoing message (fromMe = true).');
      return;
    }

    const remoteJid = key.remoteJid;
    if (!remoteJid) return;

    // Ignore group chats and status updates
    if (remoteJid.endsWith('@g.us')) {
      console.log(`Ignoring group message from JID: ${remoteJid}`);
      return;
    }
    if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) {
      console.log('Ignoring status broadcast.');
      return;
    }

    // Extract incoming text
    const incomingText = getMessageText(data.message);
    if (!incomingText) {
      console.log('No readable text content in the message. Ignoring.');
      return;
    }

    const senderName = payload.data.pushName || 'User';
    console.log(`[${senderName} (${remoteJid})]: ${incomingText}`);

    // Retrieve or initialize conversation history
    let history = conversations.get(remoteJid) || [];

    // Get response from Gemini
    const replyText = await getGeminiReply(incomingText, history);
    console.log(`[Gemini Reply for ${remoteJid}]: ${replyText}`);

    // Send the reply back to WhatsApp
    await sendWhatsAppMessage(remoteJid, replyText);
    console.log(`Successfully sent reply to ${remoteJid}`);

    // Update conversational history
    history.push({ role: 'user', parts: [{ text: incomingText }] });
    history.push({ role: 'model', parts: [{ text: replyText }] });
    conversations.set(remoteJid, cleanHistory(history));

  } catch (err) {
    console.error('Error processing webhook payload:', err.message || err);
  }
});

// Root path for health check
app.get('/', (req, res) => {
  res.send('WhatsApp Gemini Chatbot Server is running.');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
