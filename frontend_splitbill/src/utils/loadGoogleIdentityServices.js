const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

let googleScriptPromise;

export default function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google?.accounts?.id) {
          resolve(window.google.accounts.id);
        } else {
          googleScriptPromise = undefined;
          reject(new Error("Google sign in could not be loaded. Please try again."));
        }
      };
      script.onerror = () => {
        googleScriptPromise = undefined;
        reject(new Error("Google sign in could not be loaded. Please try again."));
      };
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}
