import { io } from 'socket.io-client';

function getCookie(name) {
  return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='))?.split('=')[1];
}

const socket = io('http://localhost:5000', {
  autoConnect: false,
  withCredentials: true,
  auth: () => ({ token: getCookie('token') }),
});

export default socket;
