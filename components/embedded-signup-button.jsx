"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import {
  describeSignupStep,
  featureTypeFor,
  isFacebookOrigin,
  parseSignupMessage,
} from "@/lib/embedded-signup-utils";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;
const SDK_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION || "v23.0";
// FB.login can call back before the popup's postMessage arrives; wait this long for it.
const SESSION_INFO_WAIT_MS = 5000;

let sdkPromise = null;

function loadFacebookSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: SDK_VERSION });
      resolve(window.FB);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Couldn't load Facebook's sign-in script. Check your connection or ad blocker, then try again."));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function signupConfigured() {
  return Boolean(APP_ID && CONFIG_ID);
}

/**
 * Opens Meta's Embedded Signup popup and, when the customer finishes, sends the
 * returned code and ids to our server to complete the connection.
 */
export function EmbeddedSignupButton({ onboardingType = "cloud", children, onConnected, variant, className }) {
  const [phase, setPhase] = useState("idle"); // idle | popup | connecting
  const session = useRef(null);

  useEffect(() => {
    // Warm the SDK so the popup opens straight from the click (popup blockers).
    if (signupConfigured()) loadFacebookSdk().catch(() => {});

    function onMessage(event) {
      if (!isFacebookOrigin(event.origin) || !session.current) return;
      const info = parseSignupMessage(event.data);
      if (!info) return;
      session.current.info = info;
      maybeFinish();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // maybeFinish only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fail(message) {
    session.current = null;
    setPhase("idle");
    if (message) toast.error(message);
  }

  async function maybeFinish() {
    const current = session.current;
    if (!current || current.submitted) return;
    const { info, code, closed } = current;

    if (info?.kind === "cancel") {
      const step = describeSignupStep(info.step);
      return fail(step ? `Signup was closed while ${step}. Nothing was changed.` : "Signup was cancelled. Nothing was changed.");
    }
    if (info?.kind === "error") return fail(`Meta reported a problem: ${info.message}`);
    if (info?.kind === "no_phone") {
      return fail("No phone number was added. Run the signup again and add or pick a number at the phone step.");
    }

    if (info?.kind === "finish" && code) {
      current.submitted = true;
      clearTimeout(current.timer);
      setPhase("connecting");
      try {
        const result = await api("/api/whatsapp/onboarding/exchange", {
          method: "POST",
          body: {
            code,
            wabaId: info.wabaId,
            phoneNumberId: info.phoneNumberId,
            businessId: info.businessId,
            onboardingType: info.onboardingType,
          },
        });
        session.current = null;
        setPhase("idle");
        toast.success(`Connected ${result.displayPhoneNumber || "your number"}${result.verifiedName ? ` (${result.verifiedName})` : ""}`);
        onConnected?.(result);
      } catch (error) {
        fail(error.message);
      }
      return;
    }

    if (closed && !code) {
      return fail(info ? "Meta didn't return an authorisation code. Please try again." : "Signup was closed before it finished. Nothing was changed.");
    }
    if (code && !info && !current.timer) {
      current.timer = setTimeout(() => {
        if (session.current === current && !current.info) {
          fail("Meta didn't report which number you picked. Please run the signup again.");
        }
      }, SESSION_INFO_WAIT_MS);
    }
  }

  async function start() {
    if (!signupConfigured()) {
      toast.error("Embedded Signup isn't configured yet (NEXT_PUBLIC_META_APP_ID / NEXT_PUBLIC_META_CONFIG_ID).");
      return;
    }
    let FB;
    try {
      FB = await loadFacebookSdk();
    } catch (error) {
      toast.error(error.message);
      return;
    }

    session.current = { onboardingType, info: null, code: null, closed: false, submitted: false, timer: null };
    setPhase("popup");
    const current = session.current;

    // FB.login rejects async callbacks, so keep this one synchronous.
    FB.login(
      (response) => {
        if (session.current !== current) return;
        current.code = response?.authResponse?.code || null;
        current.closed = true;
        maybeFinish();
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: featureTypeFor(onboardingType),
          sessionInfoVersion: "3",
        },
      }
    );
  }

  const busy = phase !== "idle";
  return (
    <Button type="button" onClick={start} disabled={busy} variant={variant} className={className}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {phase === "popup" ? "Finish in the Meta window…" : phase === "connecting" ? "Connecting your number…" : children}
    </Button>
  );
}
