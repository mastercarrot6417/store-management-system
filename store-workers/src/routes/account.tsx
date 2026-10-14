import { Hono } from "hono";
import { createCustomer, customerEmailExists, findCustomerForLogin, getCustomerProfile, upsertGoogleCustomer } from "../lib/accounts";
import { setFlash } from "../lib/flash";
import { CUSTOMER_GOOGLE, finishGoogleLogin, googleConfigured, startGoogleLogin } from "../lib/google";
import { hashPassword, passwordProblem, verifyPassword } from "../lib/passwords";
import { allowLoginAttempt, TOO_MANY_ATTEMPTS } from "../lib/rate-limit";
import { endSession, startSession } from "../lib/session";
import type { AppEnv } from "../types";
import { CustomerLoginPage, SignupPage, type SignupValues } from "../views/auth/AuthPages";
import { AccountPage } from "../views/public/AccountPage";
import { formText, renderPublic } from "./render";

/**
 * Customer login, sign-up, account page and Google login, ported from
 * login.php, signup.php, user_page.php, logout.php and google_callback.php.
 * Mounted inside the public routes, so c.var.customerSession is already set.
 */
const accountRoutes = new Hono<AppEnv>();

const INVALID_LOGIN = "Invalid email or password.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Login ----

accountRoutes.get("/login", (c) => {
  if (c.var.customerSession) return c.redirect("/account");
  return c.html(<CustomerLoginPage email="" error={null} flash={c.var.flash} googleEnabled={googleConfigured(c.env)} />);
});

accountRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = formText(body, "email", 254);
  // The PHP site trimmed passwords before hashing them, so trim here too.
  const password = formText(body, "password", 500);
  const fail = (error: string, status: 400 | 401 | 429) =>
    c.html(<CustomerLoginPage email={email} error={error} flash={null} googleEnabled={googleConfigured(c.env)} />, status);

  if (!email || !password) return fail("Please enter your email and password.", 400);
  if (!(await allowLoginAttempt(c, "customer-login", email))) return fail(TOO_MANY_ATTEMPTS, 429);

  const customer = await findCustomerForLogin(c.var.db, email);
  if (!(await verifyPassword(password, customer?.password ?? null)) || !customer) return fail(INVALID_LOGIN, 401);

  await startSession(c, "customer", customer.id);
  return c.redirect("/account");
});

// ---- Sign up ----

accountRoutes.get("/signup", (c) => {
  if (c.var.customerSession) return c.redirect("/account");
  return c.html(<SignupPage values={{ fullName: "", email: "", phone: "" }} error={null} googleEnabled={googleConfigured(c.env)} />);
});

accountRoutes.post("/signup", async (c) => {
  const body = await c.req.parseBody();
  const values: SignupValues = {
    fullName: formText(body, "full_name", 100),
    email: formText(body, "email", 254),
    phone: formText(body, "phone", 30),
  };
  const password = formText(body, "password", 500);
  const confirm = formText(body, "confirm_password", 500);
  const fail = (error: string, status: 400 | 429 = 400) =>
    c.html(<SignupPage values={values} error={error} googleEnabled={googleConfigured(c.env)} />, status);

  if (!values.fullName || !values.email || !password || !confirm) return fail("Please fill in all required fields.");
  if (!EMAIL_PATTERN.test(values.email)) return fail("Please enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) return fail(problem);
  if (password !== confirm) return fail("Password and confirm password do not match.");
  if (!(await allowLoginAttempt(c, "customer-signup", values.email))) return fail(TOO_MANY_ATTEMPTS, 429);

  const duplicate = "This email is already registered. Please login instead.";
  if (await customerEmailExists(c.var.db, values.email)) return fail(duplicate);

  const id = await createCustomer(c.var.db, { ...values, passwordHash: await hashPassword(password) });
  if (id === null) return fail(duplicate);

  await setFlash(c, "success", "Account created successfully. Please login.");
  return c.redirect("/login");
});

// ---- Account page and logout ----

accountRoutes.get("/account", async (c) => {
  const session = c.var.customerSession;
  if (!session) return c.redirect("/login");

  const customer = await getCustomerProfile(c.var.db, session.user.id);
  if (!customer) {
    await endSession(c, "customer");
    return c.redirect("/login");
  }
  c.header("Cache-Control", "no-store");
  return renderPublic(c, { title: "My Account - My Dream Bike", bodyClass: "account-page" }, <AccountPage customer={customer} />);
});

accountRoutes.get("/logout", async (c) => {
  await endSession(c, "customer");
  await setFlash(c, "success", "You have been logged out.");
  return c.redirect("/");
});

// ---- Google login ----

accountRoutes.get("/auth/google", async (c) => {
  if (!googleConfigured(c.env)) {
    await setFlash(c, "error", "Google login is not available right now.");
    return c.redirect("/login");
  }
  return startGoogleLogin(c, CUSTOMER_GOOGLE);
});

accountRoutes.get("/auth/google/callback", async (c) => {
  if (!googleConfigured(c.env)) return c.redirect("/login");

  const result = await finishGoogleLogin(c, CUSTOMER_GOOGLE);
  if (!result.ok) {
    await setFlash(c, "error", result.message);
    return c.redirect("/login");
  }

  const customerId = await upsertGoogleCustomer(c.var.db, result.profile);
  await startSession(c, "customer", customerId);
  return c.redirect("/account");
});

export default accountRoutes;
