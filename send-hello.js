import dotenv from 'dotenv';
dotenv.config();

const url = `${process.env.EVOLUTION_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
const apiKey = process.env.EVOLUTION_API_KEY;
const recipient = '923222685868';
const messageText = 'Hello';

console.log(`Sending "${messageText}" to ${recipient} via ${url}...`);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      number: recipient,
      text: messageText
    })
  });

  const responseText = await response.text();
  console.log(`HTTP Status: ${response.status}`);
  console.log(`Response Payload:`, responseText);

  if (response.ok) {
    console.log('Success! Message sent successfully.');
  } else {
    console.error('Failed to send message.');
  }
} catch (error) {
  console.error('Network or system error occurred:', error);
}
