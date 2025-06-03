import {
    getAuth,
    sendPasswordResetEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    update
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyAzwZfY3ypX_Dmh7EjaBsg1jjbDppnMTvs",
    authDomain: "lmsystem-c57c1.firebaseapp.com",
    databaseURL: "https://lmsystem-c57c1-default-rtdb.firebaseio.com/",
    projectId: "lmsystem-c57c1",
    storageBucket: "lmsystem-c57c1.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "1:101310858086:web:e8f6c7dfd41214ca263ea7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Check user authentication and role when the page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading state
    document.body.classList.add('loading');
    
    // Check if user is logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const uid = user.uid;
            
            // Hide both sections initially
            document.getElementById('student-info-section').style.display = 'none';
            document.getElementById('teacher-info-section').style.display = 'none';
            
            try {
                // Check if user is a student
                const studentSnapshot = await get(ref(database, 'students/' + uid));
                if (studentSnapshot.exists()) {
                    // Show student section and populate fields
                    document.getElementById('student-info-section').style.display = 'block';
                    const studentData = studentSnapshot.val();
                    
                    document.getElementById('studentFirstName').value = studentData.firstName || '';
                    document.getElementById('studentLastName').value = studentData.lastName || '';
                    document.getElementById('studentEmail').value = studentData.email || '';
                    document.getElementById('studentLRN').value = studentData.lrn || '';
                    document.getElementById('studentGrade').value = studentData.grade || '';
                    document.getElementById('studentSection').value = studentData.section || '';
                    
                    // Set up event listener for saving student info
                    document.getElementById('saveStudentInfo').addEventListener('click', () => {
                        saveStudentInformation(uid);
                    });
                } else {
                    // Check if user is a teacher
                    const teacherSnapshot = await get(ref(database, 'teachers/' + uid));
                    if (teacherSnapshot.exists()) {
                        // Show teacher section and populate fields
                        document.getElementById('teacher-info-section').style.display = 'block';
                        const teacherData = teacherSnapshot.val();
                        
                        document.getElementById('teacherFirstName').value = teacherData.firstName || '';
                        document.getElementById('teacherLastName').value = teacherData.lastName || '';
                        document.getElementById('teacherEmail').value = teacherData.email || '';
                        document.getElementById('teacherEmployeeId').value = teacherData.employeeId || '';
                        document.getElementById('teacherDepartment').value = teacherData.department || '';
                        
                        // Set up event listener for saving teacher info
                        document.getElementById('saveTeacherInfo').addEventListener('click', () => {
                            saveTeacherInformation(uid);
                        });
                    } else {
                        // User not found in either database - handle this case
                        showNotification('Error: User profile not found', 'error');
                    }
                }
                
                // Set up password change handler
                document.getElementById('updatePassword').addEventListener('click', () => {
                    updateUserPassword();
                });
                
            } catch (error) {
                console.error("Error fetching user data:", error);
                showNotification('Error loading user data: ' + error.message, 'error');
            }
            
        } else {
            // No user is signed in, redirect to login
            window.location.href = 'login.html';
        }
        
        // Hide loading state
        document.body.classList.remove('loading');
    });
});

// Save student information
async function saveStudentInformation(uid) {
    try {
        const firstName = document.getElementById('studentFirstName').value.trim();
        const lastName = document.getElementById('studentLastName').value.trim();
        const lrn = document.getElementById('studentLRN').value.trim();
        const grade = document.getElementById('studentGrade').value.trim();
        const section = document.getElementById('studentSection').value.trim();
        
        // Validate required fields
        if (!firstName || !lastName) {
            showNotification('First name and last name are required', 'error');
            return;
        }
        
        // Update in students collection
        await update(ref(database, 'students/' + uid), {
            firstName: firstName,
            lastName: lastName,
            lrn: lrn,
            grade: grade,
            section: section
        });
        
        // Update in allUsers collection
        await update(ref(database, 'allUsers/' + uid), {
            firstName: firstName,
            lastName: lastName
        });
        
        showNotification('Student information updated successfully', 'success');
    } catch (error) {
        console.error("Error saving student info:", error);
        showNotification('Error updating information: ' + error.message, 'error');
    }
}

// Save teacher information
async function saveTeacherInformation(uid) {
    try {
        const firstName = document.getElementById('teacherFirstName').value.trim();
        const lastName = document.getElementById('teacherLastName').value.trim();
        const employeeId = document.getElementById('teacherEmployeeId').value.trim();
        const department = document.getElementById('teacherDepartment').value.trim();
        
        // Validate required fields
        if (!firstName || !lastName) {
            showNotification('First name and last name are required', 'error');
            return;
        }
        
        // Update in teachers collection
        await update(ref(database, 'teachers/' + uid), {
            firstName: firstName,
            lastName: lastName,
            employeeId: employeeId,
            department: department
        });
        
        // Update in allUsers collection
        await update(ref(database, 'allUsers/' + uid), {
            firstName: firstName,
            lastName: lastName
        });
        
        showNotification('Teacher information updated successfully', 'success');
    } catch (error) {
        console.error("Error saving teacher info:", error);
        showNotification('Error updating information: ' + error.message, 'error');
    }
}

// Update user password
async function updateUserPassword() {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            showNotification('You must be logged in to change your password', 'error');
            return;
        }
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Basic validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('All password fields are required', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            showNotification('Password must be at least 6 characters long', 'error');
            return;
        }
        
        // Reauthenticate user first
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Update the password
        await updatePassword(currentUser, newPassword);
        
        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showNotification('Password updated successfully', 'success');
    } catch (error) {
        console.error("Error updating password:", error);
        
        // Handle specific errors
        if (error.code === 'auth/wrong-password') {
            showNotification('Current password is incorrect', 'error');
        } else {
            showNotification('Error updating password: ' + error.message, 'error');
        }
    }
}

// Helper to show notifications
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Append to document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}