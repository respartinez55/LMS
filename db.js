import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  child,
  update,
  remove,
  serverTimestamp
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

const STATIC_USERS = {
  admin: {
    username: "admin",
    email: "admin@admin.com",
    password: "adminpassword",
    role: "admin",
    pin: "1234"
  },
  librarian: {
    username: "librarian",
    email: "librarian@library.com",
    password: "librarianpassword",
    role: "librarian",
    pin: "5678"
  }
};

export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: `Password reset email sent to ${email}`
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function initializeDefaultAccounts() {
  try {
    for (const key in STATIC_USERS) {
      const user = STATIC_USERS[key];
      const path = `staticUsers/${user.role}/${key}`;
      const userRef = ref(database, path);
      await set(userRef, {
        username: user.username,
        email: user.email,
        password: user.password,
        pin: user.pin,
        role: user.role
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Error initializing default accounts:", error);
    return { success: false, error: error.message };
  }
}

export async function registerUser(email, password, userType) {
  try {
    // Normalize userType to lowercase and check validity
    if (!userType || typeof userType !== "string") {
      throw new Error("Please select a valid role.");
    }
    userType = userType.trim().toLowerCase();
    if (userType !== "student" && userType !== "teacher") {
      throw new Error("Please select a valid role.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // No email verification required

    await set(ref(database, 'allUsers/' + user.uid), {
      email: email,
      registeredAt: serverTimestamp(),
      status: 'pending',
      userType: userType
    });

    return {
      success: true,
      user: {
        uid: user.uid,
        email: email,
        userType: userType
      }
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function saveStudentInfo(uid, firstName, lastName, lrn, grade, section) {
  try {
    const username = uid.substring(0, 8);
    const user = auth.currentUser;
    const email = user ? user.email : "";

    await set(ref(database, 'students/' + uid), {
      username: username,
      email: email,
      firstName: firstName || "",
      lastName: lastName || "",
      lrn: lrn || "",
      grade: grade || "",
      section: section || "",
      role: 'student',
      status: 'pending',
      createdAt: serverTimestamp()
    });

    await update(ref(database, 'allUsers/' + uid), {
      userType: 'student',
      firstName: firstName || "",
      lastName: lastName || "",
      role: 'student'
    });

    return { 
      success: true
    };
  } catch (error) {
    console.error("Error saving student info:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function saveTeacherInfo(uid, firstName, lastName, employeeId, department) {
  try {
    const username = uid.substring(0, 8);
    const user = auth.currentUser;
    const email = user ? user.email : "";

    await set(ref(database, 'teachers/' + uid), {
      username: username,
      email: email,
      firstName: firstName || "",
      lastName: lastName || "",
      employeeId: employeeId || "",
      department: department || "",
      role: 'teacher',
      status: 'pending',
      createdAt: serverTimestamp()
    });

    await update(ref(database, 'allUsers/' + uid), {
      userType: 'teacher',
      firstName: firstName || "",
      lastName: lastName || "",
      role: 'teacher'
    });

    return { 
      success: true
    };
  } catch (error) {
    console.error("Error saving teacher info:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function adminLogin(email, password) {
  try {
    const staticSnapshot = await get(child(ref(database), 'staticUsers'));
    if (staticSnapshot.exists()) {
      const allRoles = staticSnapshot.val();
      for (const role in allRoles) {
        const accounts = allRoles[role];
        for (const id in accounts) {
          const account = accounts[id];
          if (account.email === email && account.password === password) {
            return {
              success: true,
              user: {
                uid: id,
                username: account.username,
                email: account.email,
                role: account.role
              },
              redirectUrl: account.role === "admin" ? "admin.html" : "librarian.html"
            };
          }
        }
      }
    }
    return { success: false, error: "Invalid credentials" };
  } catch (error) {
    console.error("Admin login error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function userLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const studentSnapshot = await get(ref(database, 'students/' + user.uid));
    if (studentSnapshot.exists()) {
      const userData = studentSnapshot.val();

      if (userData.status === 'blocked') {
        return {
          success: false,
          error: "Your account has been blocked. Please contact admin for assistance."
        };
      }

      if (userData.status === 'pending') {
        return {
          success: false,
          error: "Your account is pending approval. Please wait for admin approval before logging in."
        };
      }

      // No email verification required

      return {
        success: true,
        user: {
          uid: user.uid,
          username: userData.username || "",
          email: userData.email || "",
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          role: 'student',
          status: userData.status
        },
        redirectUrl: "student-dashboard.html"
      };
    }

    const teacherSnapshot = await get(ref(database, 'teachers/' + user.uid));
    if (teacherSnapshot.exists()) {
      const userData = teacherSnapshot.val();

      if (userData.status === 'blocked') {
        return {
          success: false,
          error: "Your account has been blocked. Please contact admin for assistance."
        };
      }

      if (userData.status === 'pending') {
        return {
          success: false,
          error: "Your account is pending approval. Please wait for admin approval before logging in."
        };
      }

      // No email verification required

      return {
        success: true,
        user: {
          uid: user.uid,
          username: userData.username || "",
          email: userData.email || "",
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          role: 'teacher',
          status: userData.status
        },
        redirectUrl: "teacher-dashboard.html"
      };
    }

    return {
      success: false,
      error: "User account not found. Please complete registration."
    };
  } catch (error) {
    console.error("User login error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// The following functions are now just for admin/utility, not for email verification

export async function checkUserRole(uid) {
  try {
    const studentSnapshot = await get(ref(database, 'students/' + uid));
    if (studentSnapshot.exists()) {
      return studentSnapshot.val().role || 'student';
    }

    const teacherSnapshot = await get(ref(database, 'teachers/' + uid));
    if (teacherSnapshot.exists()) {
      return teacherSnapshot.val().role || 'teacher';
    }

    return null;
  } catch (error) {
    console.error("Error checking user role:", error);
    return null;
  }
}

export async function getUserDataForAdmin(uid, userType) {
  try {
    const path = userType === 'student' ? 'students/' : 'teachers/';
    const snapshot = await get(ref(database, path + uid));

    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
}

export async function getAllUsers() {
  try {
    const students = {};
    const teachers = {};
    const allUsers = {};

    const allUsersSnapshot = await get(ref(database, 'allUsers'));
    if (allUsersSnapshot.exists()) {
      Object.assign(allUsers, allUsersSnapshot.val());
    }

    const studentsSnapshot = await get(ref(database, 'students'));
    if (studentsSnapshot.exists()) {
      Object.assign(students, studentsSnapshot.val());
    }

    const teachersSnapshot = await get(ref(database, 'teachers'));
    if (teachersSnapshot.exists()) {
      Object.assign(teachers, teachersSnapshot.val());
    }

    return {
      success: true,
      students,
      teachers,
      allUsers
    };
  } catch (error) {
    console.error("Error getting all users:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function updateUserStatus(uid, userType, status) {
  try {
    const path = userType === 'student' ? 'students/' : 'teachers/';
    const userRef = ref(database, path + uid);

    await update(userRef, {
      status: status
    });

    await update(ref(database, 'allUsers/' + uid), {
      status: status
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating user status:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function deleteAccount(uid) {
  try {
    let deleted = false;

    const studentRef = ref(database, 'students/' + uid);
    const studentSnapshot = await get(studentRef);
    if (studentSnapshot.exists()) {
      await remove(studentRef);
      deleted = true;
    }

    if (!deleted) {
      const teacherRef = ref(database, 'teachers/' + uid);
      const teacherSnapshot = await get(teacherRef);
      if (teacherSnapshot.exists()) {
        await remove(teacherRef);
        deleted = true;
      }
    }

    const allUsersRef = ref(database, 'allUsers/' + uid);
    await remove(allUsersRef);

    return { 
      success: deleted,
      error: deleted ? null : "User not found"
    };
  } catch (error) {
    console.error("Error deleting account:", error);
    return {
      success: false,
      error: error.message
    };
  }
}