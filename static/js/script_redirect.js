function addAndUploadFiles() {
    const projectName = document.getElementById('projectName').value;

    // Early exit if no project name is provided
    if (!projectName) {
        alert('Please enter a project name.');
        return;
    }

    // First, add the project
    let formDataProject = new FormData();
    formDataProject.append('projectName', projectName);

    fetch('http://localhost:5000/add_project', {
        method: 'POST',
        body: formDataProject
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to add project');
        }
        return response.json();
    })
    .then(data => {
        console.log('Project added successfully:', data);
        uploadFiles();
    })
    .catch(error => {
        console.error('Error adding project:', error);
    });
}

function uploadFiles() {
    var ortho = document.getElementById('ortho').files[0];
    var dem = document.getElementById('dem').files[0];
    var dtm = document.getElementById('dtm').files[0];

    var maxSize = 350 * 1024 * 1024; // 350 MB
    if ((ortho && ortho.size > maxSize) || 
        (dem && dem.size > maxSize) || 
        (dtm && dtm.size > maxSize)) {
        alert('Each file must be no larger than 250MB.');
        return;
    }

    let formData = new FormData(document.getElementById('uploadForm'));

    fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        document.getElementById('statusText').textContent = 'Upload successful! Processing...';
        checkStatus();
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('statusText').textContent = 'Upload failed. Please try again.';
    });
}

function openResultsPage() {
    // ✅ Updated for Flask routing
    window.location.href = '/results';
}

function checkStatus() {
    fetch('http://localhost:5000/status')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'done') {
                document.getElementById('resultsButton').disabled = false;
                document.getElementById('statusText').textContent = 'Processing complete!';
            } else if (data.status === 'error') {
                document.getElementById('statusText').textContent = 'An error occurred during processing.';
            } else {
                setTimeout(checkStatus, 5000);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Keep checking every 5 seconds until done
checkStatus();
