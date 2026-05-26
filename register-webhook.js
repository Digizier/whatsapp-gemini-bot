import dotenv from 'dotenv';
dotenv.config();

const webhookUrl = 'https://busy-parrots-admire.loca.lt/webhook';
const url = `${process.env.EVOLUTION_URL}/webhook/set/${process.env.EVOLUTION_INSTANCE}`;
const apiKey = process.env.EVOLUTION_API_KEY;

console.log(`Registering webhook: ${webhookUrl} at ${url}...`);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: [
          'MESSAGES_UPSERT'
        ]
      }
    })
  });

  const responseText = await response.text();
  console.log(`HTTP Status: ${response.status}`);
  console.log(`Response Payload:`, responseText);

  if (response.ok) {
    console.log('Success! Webhook registered successfully.');
  } else {
    console.error('Failed to register webhook.');
  }
} catch (error) {
  console.error('Network or system error occurred:', error);
}
