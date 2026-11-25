// register.js
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('registerForm').addEventListener('submit', function(event) {
        event.preventDefault();
        register();
    });
});

function register() {
    var username = document.getElementById('newUsername').value;
    var password = document.getElementById('newPassword').value;
    var confirmPassword = document.getElementById('confirmPassword').value;

    let formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('confirm_password', confirmPassword);

    fetch('http://localhost:5000/register', {
        method: 'POST',
        body: formData
    }).then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.location.href = 'http://127.0.0.1:5500/login.html'; // Redirect to login page on successful registration
            // Or possibly log them in directly and redirect to '/index.html'
        } else {
            document.getElementById('registerStatusText').textContent = data.message;
        }
    }).catch(error => {
        console.error('Error:', error);
        document.getElementById('registerStatusText').textContent = 'Registration failed. Please try again.';
    });
}