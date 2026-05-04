import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);

  const { data: vapidData } = trpc.push.getVapidKey.useQuery();
  const { data: statusData, refetch: refetchStatus } = trpc.push.getStatus.useQuery();

  const subscribeMutation = trpc.push.subscribe.useMutation({
    onSuccess: () => {
      setIsSubscribed(true);
      refetchStatus();
    },
    onError: (err) => {
      toast.error("Erro ao ativar notificações: " + err.message);
    },
  });

  const unsubscribeMutation = trpc.push.unsubscribe.useMutation({
    onSuccess: () => {
      setIsSubscribed(false);
      refetchStatus();
    },
    onError: (err) => {
      toast.error("Erro ao desativar notificações: " + err.message);
    },
  });

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkCurrentSubscription();
    }
  }, []);

  useEffect(() => {
    if (statusData !== undefined) {
      setIsSubscribed(statusData.enabled);
    }
  }, [statusData]);

  async function checkCurrentSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setCurrentSubscription(sub);
      setIsSubscribed(sub !== null);
    } catch (_) {}
  }

  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidData?.publicKey) return;

    setIsLoading(true);
    try {
      // Pedir permissão
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error("Permissão de notificação negada.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey).buffer as ArrayBuffer,
      });

      const subJson = subscription.toJSON();
      const keys = subJson.keys as { p256dh: string; auth: string };

      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      setCurrentSubscription(subscription);
      toast.success("Notificacoes ativadas com sucesso!");
    } catch (err: any) {
      toast.error("Falha ao ativar notificacoes: " + (err.message || "Tente novamente."));
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidData, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    if (!currentSubscription) return;
    setIsLoading(true);
    try {
      await unsubscribeMutation.mutateAsync({ endpoint: currentSubscription.endpoint });
      await currentSubscription.unsubscribe();
      setCurrentSubscription(null);
      toast.success("Notificacoes desativadas.");
    } catch (err: any) {
      toast.error("Falha ao desativar notificacoes: " + (err.message || "Tente novamente."));
    } finally {
      setIsLoading(false);
    }
  }, [currentSubscription, unsubscribeMutation]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
