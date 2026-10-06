import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let supabase;
let authStateSubscription;

export async function initializeSupabaseAuth() {
  const response = await fetch(`${window.CLEARREQ_API_BASE || ""}/public-config`);
  if (!response.ok) {
    throw new Error("Could not load Supabase configuration from the backend.");
  }
  const config = await response.json();
  if (!config.supabase_url || !config.supabase_anon_key) {
    throw new Error("Supabase URL and anon key are required.");
  }
  supabase = createClient(config.supabase_url, config.supabase_anon_key);
  return supabase;
}

export function getSupabaseClient() {
  if (!supabase) throw new Error("Supabase Auth has not been initialized.");
  return supabase;
}

export async function getCurrentSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthState(callback) {
  authStateSubscription?.unsubscribe();
  const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  authStateSubscription = data.subscription;
}

export async function signInWithPassword(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, name) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
