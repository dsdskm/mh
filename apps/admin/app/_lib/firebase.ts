import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirestoreClient(): Firestore | null {
  console.log(`getFirestoreClient`)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  console.log(`[Firestore] API Key: ${apiKey ? "****" : "Not Set"}, Project ID: ${projectId ?? "Not Set"}`);
  if (!apiKey || !projectId) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[Firestore] NEXT_PUBLIC_FIREBASE_API_KEY 또는 NEXT_PUBLIC_FIREBASE_PROJECT_ID 가 설정되지 않아 실시간 알림이 비활성화됩니다.',
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
