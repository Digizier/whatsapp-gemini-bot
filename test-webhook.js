console.log('Sending mock messages.upsert payload to local webhook on port 3000...');

try {
  const response = await fetch('http://localhost:3000/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: 'messages.upsert',
      instance: 'nadir',
      data: {
        key: {
          remoteJid: '923222685868@s.whatsapp.net',
          fromMe: false,
          id: 'TEST_MESSAGE_ID_123'
        },
        message: {
          conversation: 'Hello! What is the capital of France?'
        },
        pushName: 'Nadir Test'
      }
    })
  });

  console.log(`HTTP Status: ${response.status}`);
  if (response.ok) {
    console.log('Success! Mock payload sent successfully.');
  } else {
    console.error('Failed to send mock payload.');
  }
} catch (error) {
  console.error('Error sending mock payload:', error);
}
