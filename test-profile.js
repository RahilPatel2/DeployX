const http = require('http');

async function run() {
  const ts = Date.now();
  const email = `profile${ts}@test.com`;
  const username = `profiletest${ts}`;
  
  // First, signup
  const signupRes = await fetch('http://localhost:3001/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Profile Test', username, email, password: 'Password123!' })
  });
  console.log('Signup:', signupRes.status);
  console.log('Signup Body:', await signupRes.json());

  // Now login
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: 'Password123!' })
  });
  console.log('Login:', loginRes.status);
  let cookie = loginRes.headers.get('set-cookie');
  if (cookie) cookie = cookie.split(';')[0];
  
  const profileRes = await fetch('http://localhost:3001/api/auth/profile', {
    method: 'GET',
    headers: { 'Cookie': cookie || '' }
  });
  console.log('Profile Status:', profileRes.status);
  console.log('Profile Body:', await profileRes.text());
}
run();
