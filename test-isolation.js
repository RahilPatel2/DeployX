const http = require('http');

async function run() {
  const baseUrl = 'http://localhost:3000'; // actually 3001
  
  // 1. Signup User A
  const resA = await fetch(`http://localhost:3000/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'User A', username: 'usera_' + Date.now(), email: 'a' + Date.now() + '@test.com', password: 'Password123!' })
  });
  
  let cookieA = resA.headers.get('set-cookie');
  if (cookieA) cookieA = cookieA.split(';')[0];
  console.log('User A Signup:', resA.status);

  // 2. Signup User B
  const resB = await fetch(`http://localhost:3000/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'User B', username: 'userb_' + Date.now(), email: 'b' + Date.now() + '@test.com', password: 'Password123!' })
  });
  let cookieB = resB.headers.get('set-cookie');
  if (cookieB) cookieB = cookieB.split(';')[0];
  console.log('User B Signup:', resB.status);

  // 3. User A creates a project
  const createProjRes = await fetch(`http://localhost:3000/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ name: 'Project A', repository: 'repo/A' })
  });
  console.log('User A Project Create:', createProjRes.status);
  const projData = await createProjRes.json();
  const projectId = projData.project._id;

  // 4. User B tries to fetch User A's project
  const fetchProjRes = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
    method: 'GET',
    headers: { 'Cookie': cookieB }
  });
  console.log('User B Fetches User A Project:', fetchProjRes.status, await fetchProjRes.json());
}
run();
