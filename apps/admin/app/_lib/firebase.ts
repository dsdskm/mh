import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let hasWarnedMissingConfig = false;
const shouldWarnMissingFirebaseConfig =
  process.env.NEXT_PUBLIC_WARN_MISSING_FIREBASE_CONFIG === "true";

export function getFirestoreClient(): Firestore | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    if (typeof window !== "undefined" && shouldWarnMissingFirebaseConfig && !hasWarnedMissingConfig) {
      hasWarnedMissingConfig = true;
      console.warn(
        "[Firestore] Firebase 환경변수가 없어 실시간 알림 기능을 비활성화합니다.",
      );
    }

    return null;
  }

  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  }

  if (!db) {
    db = getFirestore(app);
  }

  return db;
}
