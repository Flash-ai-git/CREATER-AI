import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

export interface FirebaseAuthHelper {
  auth: any;
  provider: GoogleAuthProvider;
}

let isInitialized = false;

// Gracefully retrieve Firebase Configuration at runtime
export async function getFirebaseConfig() {
  return firebaseConfig;
}

export async function initFirebaseAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  const config = firebaseConfig;
  if (!config) {
    if (onAuthFailure) onAuthFailure();
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    
    // Request YouTube upload and standard scopes
    provider.addScope("https://www.googleapis.com/auth/youtube.upload");
    provider.addScope("https://www.googleapis.com/auth/youtube");
    provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

    let cachedAccessToken: string | null = null;
    let isSigningIn = false;

    onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else {
          // If already signed in on reload but token is missing, we re-prompt or notify failure
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    });

    isInitialized = true;
    return { auth, provider };
  } catch (err) {
    console.error("Failed to initialize Firebase app:", err);
    if (onAuthFailure) onAuthFailure();
    return null;
  }
}

export async function googleSignInWithYouTube(): Promise<{ user: User; accessToken: string } | null> {
  const config = await getFirebaseConfig();
  if (!config) {
    throw new Error("Credentials/OAuth configuration is not fully set up. Please read/accept the Google integration invitation.");
  }

  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  
  provider.addScope("https://www.googleapis.com/auth/youtube.upload");
  provider.addScope("https://www.googleapis.com/auth/youtube");
  provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve integration access token from login.");
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error) {
    console.error("Sign in with YouTube failed:", error);
    throw error;
  }
}
