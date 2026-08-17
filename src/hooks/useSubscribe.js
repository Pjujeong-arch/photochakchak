import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAuthConfig,
  fetchSession,
  loginWithGoogleCredential,
  logoutSession,
  activateSubscribe,
  toErrorMessage,
} from "../services/index.js";

function gis() {
  return window.google?.accounts?.id;
}

function fedcmButtonOk() {
  if (!("IdentityCredential" in window)) return false;
  const ua = navigator.userAgent || "";
  if (/Edg|OPR|Opera|SamsungBrowser|YaBrowser/i.test(ua)) return false;
  const android = /Android/i.test(ua);
  const ver = Number((ua.match(/Chrome\/(\d+)/) || [])[1] || 0);
  return android ? ver >= 128 : ver >= 125;
}

/**
 * @param {{ show: (msg: string) => void }} toast
 */
export function useSubscribe(toast) {
  const [me, setMe] = useState(
    /** @type {import('../types/photochak').SubscribeUser | null} */ (null)
  );
  const [clientId, setClientId] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const btnRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const inited = useRef("");
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const refresh = useCallback(async () => {
    try {
      const user = await fetchSession();
      setMe(user?.email ? user : null);
      return user;
    } catch (err) {
      setMe(null);
      setError(toErrorMessage(err, "세션을 확인할 수 없습니다."));
      return null;
    }
  }, []);

  const paintButton = useCallback(() => {
    const g = gis();
    const el = btnRef.current;
    if (!g || !clientId || !el || el.hidden) return false;
    try {
      if (inited.current !== clientId) {
        g.initialize({
          client_id: clientId,
          callback: (res) => {
            setAuthLoading(true);
            setError(null);
            loginWithGoogleCredential(res.credential)
              .then((user) => {
                setMe(user);
                toastRef.current.show("구글 로그인되었습니다.");
              })
              .catch((err) => {
                const msg = toErrorMessage(err, "구글 로그인에 실패했습니다.");
                setError(msg);
                toastRef.current.show(msg);
              })
              .finally(() => setAuthLoading(false));
          },
          ...(fedcmButtonOk() ? { use_fedcm_for_button: true } : {}),
        });
        inited.current = clientId;
      }
      el.replaceChildren();
      g.renderButton(el, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "signin_with",
        shape: "pill",
        width: 240,
        logo_alignment: "left",
        locale: "ko",
      });
    } catch {
      return false;
    }
    return Boolean(el.querySelector("iframe, button, [role='button']"));
  }, [clientId]);

  const mountButton = useCallback(() => {
    if (!clientId) return;
    let n = 0;
    const tick = () => {
      n += 1;
      if (paintButton() || n > 25) return;
      window.setTimeout(tick, 80);
    };
    window.requestAnimationFrame(tick);
  }, [clientId, paintButton]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cfg = await fetchAuthConfig();
        if (!cancelled) {
          setClientId(cfg.googleClientId || "");
          if (!cfg.googleClientId) {
            setError("GOOGLE_CLIENT_ID가 .env.local에 없습니다.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setClientId("");
          setError(toErrorMessage(err, "인증 설정을 불러오지 못했습니다."));
        }
      }
      await refresh();
      if (!cancelled) {
        setReady(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!ready || loading || !clientId || me?.email) return undefined;
    let n = 0;
    const wait = window.setInterval(() => {
      n += 1;
      if (paintButton()) {
        window.clearInterval(wait);
        return;
      }
      if (n > 40 && !gis()) {
        window.clearInterval(wait);
        setError("Google 로그인 스크립트를 불러오지 못했습니다.");
      } else if (n > 50) {
        window.clearInterval(wait);
      }
    }, 100);
    return () => window.clearInterval(wait);
  }, [ready, loading, clientId, me, paintButton]);

  const logout = useCallback(async () => {
    setAuthLoading(true);
    setError(null);
    try {
      await logoutSession();
      setMe(null);
      toast.show("로그아웃했습니다.");
    } catch (err) {
      const msg = toErrorMessage(err, "로그아웃에 실패했습니다.");
      setError(msg);
      toast.show(msg);
    } finally {
      setAuthLoading(false);
    }
  }, [toast]);

  const startPlan = useCallback(async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const user = await activateSubscribe();
      setMe(user);
      toast.show("구독이 켜졌습니다. 베스트 10을 이용할 수 있어요.");
      return user;
    } catch (err) {
      const msg = toErrorMessage(err, "구독에 실패했습니다.");
      setError(msg);
      toast.show(msg);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, [toast]);

  return {
    me,
    btnRef,
    logout,
    startPlan,
    mountButton,
    clientId,
    loading,
    authLoading,
    error,
  };
}
