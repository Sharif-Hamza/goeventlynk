import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys generated:');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

console.log('\nInstructions:');
console.log('1. Add these keys to your production environment:');
console.log('   VITE_VAPID_PUBLIC_KEY=<public key>');
console.log('   VAPID_PRIVATE_KEY=<private key>');
console.log('\n2. Add the public key to your .env file:');
console.log('   VITE_VAPID_PUBLIC_KEY=<public key>');