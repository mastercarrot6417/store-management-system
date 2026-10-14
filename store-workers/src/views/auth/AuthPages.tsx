import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import type { Flash } from "../../lib/flash";
import { MIN_PASSWORD_LENGTH } from "../../lib/passwords";
import { Document } from "../Document";

/** Login and sign-up pages, ported from login.php, signup.php and admin/login.php. */

const GOOGLE_ICON = raw(
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>',
);

type Message = { success?: string | null; error?: string | null };

function messagesFrom(flash: Flash | null, error: string | null): Message {
  return {
    success: flash?.kind === "success" ? flash.message : null,
    error: error ?? (flash?.kind === "error" ? flash.message : null),
  };
}

function AuthShell(props: { title: string; heading: string; subtitle: string; fonts: "public" | "admin"; boxClass?: string; message: Message; children: Child }) {
  return (
    <Document title={props.title} fonts={props.fonts} stylesheets={["/assets/css/style.css"]} scripts={["/assets/js/app.js"]}>
      <div class={`login-container ${props.fonts === "public" ? "customer-auth-page" : ""}`}>
        <div class={`login-box ${props.boxClass ?? ""}`}>
          <div class="auth-brand-logo"><img src="/company_logo/ori.logo.png" alt="My Dream Bike" /></div>
          <h2>{props.heading}</h2>
          <p class="login-subtitle">{props.subtitle}</p>
          {props.message.success && <div class="success-msg">{props.message.success}</div>}
          {props.message.error && <div class="error-msg">{props.message.error}</div>}
          {props.children}
        </div>
      </div>
    </Document>
  );
}

type CustomerLoginProps = { email: string; error: string | null; flash: Flash | null; googleEnabled: boolean };

export function CustomerLoginPage({ email, error, flash, googleEnabled }: CustomerLoginProps) {
  return (
    <AuthShell
      title="Customer Login - My Dream Bike"
      heading="Customer Login"
      subtitle="Sign in to view your My Dream Bike account"
      fonts="public"
      boxClass="customer-auth-box"
      message={messagesFrom(flash, error)}
    >
      <form method="post" action="/login">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" value={email} autocomplete="email" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" placeholder="Enter your password" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn-login">Login</button>
      </form>

      {googleEnabled && (
        <>
          <div class="auth-divider"><span>OR</span></div>
          <a href="/auth/google" class="btn-google-auth">{GOOGLE_ICON} Continue with Google</a>
        </>
      )}
      <a href="/" class="btn-guest-auth">Continue as Guest</a>

      <p class="auth-switch">Don't have an account? <a href="/signup">Sign Up</a></p>
      <p class="auth-back"><a href="/">← Back to Store</a></p>
    </AuthShell>
  );
}

export type SignupValues = { fullName: string; email: string; phone: string };

type SignupProps = { values: SignupValues; error: string | null; googleEnabled: boolean };

export function SignupPage({ values, error, googleEnabled }: SignupProps) {
  return (
    <AuthShell
      title="Customer Sign Up - My Dream Bike"
      heading="Create Account"
      subtitle="Join My Dream Bike for a faster shopping experience"
      fonts="public"
      boxClass="customer-auth-box"
      message={{ error }}
    >
      <form method="post" action="/signup">
        <div class="form-group">
          <label for="full_name">Full Name *</label>
          <input type="text" id="full_name" name="full_name" placeholder="Your full name" value={values.fullName} autocomplete="name" maxlength={100} required />
        </div>
        <div class="form-group">
          <label for="email">Email Address *</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" value={values.email} autocomplete="email" maxlength={254} required />
        </div>
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input type="text" id="phone" name="phone" placeholder="01X-XXX XXXX" value={values.phone} autocomplete="tel" maxlength={30} />
        </div>
        <div class="form-group">
          <label for="password">Password *</label>
          <input type="password" id="password" name="password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} autocomplete="new-password" minlength={MIN_PASSWORD_LENGTH} required />
        </div>
        <div class="form-group">
          <label for="confirm_password">Confirm Password *</label>
          <input type="password" id="confirm_password" name="confirm_password" placeholder="Retype your password" autocomplete="new-password" required />
        </div>
        <button type="submit" class="btn-login">Create Account</button>
      </form>

      {googleEnabled && (
        <>
          <div class="auth-divider"><span>OR</span></div>
          <a href="/auth/google" class="btn-google-auth">{GOOGLE_ICON} Continue with Google</a>
        </>
      )}
      <a href="/" class="btn-guest-auth">Continue as Guest</a>

      <p class="auth-switch">Already have an account? <a href="/login">Login</a></p>
      <p class="auth-back"><a href="/">← Back to Store</a></p>
    </AuthShell>
  );
}

type AdminLoginProps = { email: string; error: string | null; flash: Flash | null; googleEnabled: boolean };

export function AdminLoginPage({ email, error, flash, googleEnabled }: AdminLoginProps) {
  return (
    <AuthShell
      title="Admin Login - My Dream Bike"
      heading="Admin Login"
      subtitle="Sign in to manage your store"
      fonts="admin"
      message={messagesFrom(flash, error)}
    >
      <form method="post" action="/admin/login">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="admin@store.com" value={email} autocomplete="username" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" placeholder="Enter your password" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn-login">Sign In</button>
      </form>

      {googleEnabled && (
        <>
          <div class="divider" style="text-align: center; margin: 20px 0; position: relative;">
            <hr style="border: 0; border-top: 1px solid #333; position: absolute; width: 100%; top: 50%; z-index: 1;" />
            <span style="background: #1a1a2e; padding: 0 10px; position: relative; z-index: 2; color: #aaa; font-size: 14px;">OR</span>
          </div>
          <a
            href="/admin/auth/google"
            class="btn-google"
            style="display: flex; align-items: center; justify-content: center; gap: 10px; background-color: white; color: #333; padding: 12px; border-radius: 4px; text-decoration: none; font-weight: 600; border: 1px solid #ccc; transition: all 0.3s ease;"
          >
            {GOOGLE_ICON} Sign in with Google
          </a>
        </>
      )}

      <p style="text-align:center;margin-top:20px;">
        <a href="/" style="color:#aaa;font-size:13px;">← Back to Store</a>
      </p>
    </AuthShell>
  );
}
