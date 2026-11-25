// login.js
document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('loginForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission
        login();
    });
});

function login() {
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    let formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    fetch('http://localhost:5000/login', {
        method: 'POST',
        body: formData
    }).then(response => {
        if (!response.ok) {
            throw new Error('Login failed');
        }
        return response.json();
    }).then(data => {
        if (data.status === 'success') {
            window.location.href = 'http://127.0.0.1:5500/index.html'; // Redirect to index.html on successful login
        } else {
            document.getElementById('statusText').textContent = 'Invalid credentials. Please try again.';
        }
    }).catch(error => {
        console.error('Error:', error);
        document.getElementById('statusText').textContent = 'Login failed. Please try again.';
    });
}