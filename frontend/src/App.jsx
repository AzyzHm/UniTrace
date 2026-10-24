import { useEffect, useState } from 'react';
import axios from 'axios';

export default function App() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    axios
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <main className="page">
      <h1>UniTrace test frontend</h1>
      <p>
        Backend health: <strong>{status}</strong>
      </p>
    </main>
  );
}