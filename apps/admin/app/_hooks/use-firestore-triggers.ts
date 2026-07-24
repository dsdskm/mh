"use client";

import { useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreClient } from "../_lib/firebase";

type TriggerType = "orders" | "inquiries" | "reviews";

type Callbacks = {
  onOrders?: () => void;
  onInquiries?: () => void;
  onReviews?: () => void;
};

const POLL_INTERVAL_MS = 15000;

/**
 * Firestore admin-triggers 컬렉션을 구독하여 변경 감지 시 콜백을 호출합니다.
 * 마운트 시 초기 스냅샷은 무시하고 이후 변경(서버 트리거)에만 반응합니다.
 */
export function useFirestoreTriggers(callbacks: Callbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollingTimer) {
        return;
      }

      pollingTimer = setInterval(() => {
        callbacksRef.current.onOrders?.();
        callbacksRef.current.onInquiries?.();
        callbacksRef.current.onReviews?.();
      }, POLL_INTERVAL_MS);
    };

    const db = getFirestoreClient();
    if (!db) {
      startPolling();
      return () => {
        if (pollingTimer) {
          clearInterval(pollingTimer);
        }
      };
    }

    const types: TriggerType[] = ["orders", "inquiries", "reviews"];
    const unsubscribes: (() => void)[] = [];

    for (const type of types) {
      let initialized = false;

      const unsub = onSnapshot(
        doc(db, "admin-triggers", type),
        (snapshot) => {
          // 첫 번째 스냅샷(마운트 시 현재 값)은 무시
          if (!initialized) {
            initialized = true;
            return;
          }

          if (!snapshot.exists()) return;

          if (type === "orders") callbacksRef.current.onOrders?.();
          if (type === "inquiries") callbacksRef.current.onInquiries?.();
          if (type === "reviews") callbacksRef.current.onReviews?.();
        },
        () => {
          startPolling();
        },
      );

      unsubscribes.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribes) unsub();
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, []);
}
