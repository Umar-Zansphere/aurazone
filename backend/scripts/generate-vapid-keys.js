const webPush = require('web-push');

console.log('\n🔑 Generating VAPID Keys for Push Notifications...\n');

const vapidKeys = webPush.generateVAPIDKeys();

console.log('✅ VAPID Keys Generated Successfully!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Add these to your .env files:\n');

console.log('Backend (.env):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@solemate.com');
console.log('');

console.log('Frontend (.env.local):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n⚠️  IMPORTANT:');
console.log('   - Keep the PRIVATE key SECRET - never commit it to version control');
console.log('   - The PUBLIC key can be shared with the frontend');
console.log('   - Update VAPID_SUBJECT with your actual email or website URL');
console.log('\n✨ Next steps:');
console.log('   1. Copy the keys to your .env files');
console.log('   2. Run: npx prisma migrate dev --name add_push_subscriptions');
console.log('   3. Restart your backend server');
console.log('   4. Test push notifications from the frontend\n');
