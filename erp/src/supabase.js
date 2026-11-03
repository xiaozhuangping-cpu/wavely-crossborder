import { createClient } from '@supabase/supabase-js';
import { supabaseDataProvider } from 'ra-supabase-core';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const dataProvider = supabaseDataProvider({
  instanceUrl: SUPABASE_URL,
  apiKey: SUPABASE_KEY,
  supabaseClient: supabase,
  primaryKeys: new Map([['exchange_rates', ['currency']]]),
});

// 演示站：访客一键匿名登录，无需注册
export const authProvider = {
  async login() {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  },
  async logout() {
    await supabase.auth.signOut();
  },
  async checkAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('未登录');
  },
  async checkError(error) {
    if (error?.status === 401) throw new Error('会话已过期');
  },
  async getIdentity() {
    const { data } = await supabase.auth.getUser();
    return { id: data.user?.id ?? 'guest', fullName: '演示访客' };
  },
  async getPermissions() {
    return 'demo';
  },
};
