import { supabase } from './supabase';

export async function getOrCreateWallet(phone: string) {
  const { data: existing } = await supabase
    .from('wallets')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('wallets')
    .insert({ phone, balance: 0 })
    .select()
    .single();

  if (error) {
    return { id: null, phone, balance: 0, created_at: '', updated_at: '' };
  }
  return created;
}

export async function getWalletBalance(phone: string): Promise<number> {
  const { data } = await supabase
    .from('wallets')
    .select('balance')
    .eq('phone', phone)
    .maybeSingle();
  return data?.balance ?? 0;
}

export async function topUpWallet(
  phone: string,
  amount: number,
  method: 'cliq' | 'iban' = 'cliq',
  proofUrl: string | null = null,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount <= 0) return { success: false, newBalance: 0, error: 'مبلغ غير صحيح' };

  const wallet = await getOrCreateWallet(phone);
  if (!wallet.id) return { success: false, newBalance: 0, error: 'ما زبط إنشاء المحفظة' };

  const newBalance = wallet.balance + amount;

  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (updateError) return { success: false, newBalance: wallet.balance, error: 'ما زبط تحديث الرصيد' };

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    phone,
    amount,
    type: 'topup',
  });

  await supabase.from('wallet_topups').insert({
    wallet_id: wallet.id,
    phone,
    amount,
    method,
    proof_url: proofUrl,
    status: 'approved',
  });

  return { success: true, newBalance };
}

export async function chargeWalletForRide(
  phone: string,
  amount: number,
  rideId: string,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount <= 0) return { success: false, newBalance: 0, error: 'مبلغ غير صحيح' };

  const wallet = await getOrCreateWallet(phone);
  if (!wallet.id) return { success: false, newBalance: 0, error: 'ما عندك محفظة' };

  if (wallet.balance < amount) {
    return { success: false, newBalance: wallet.balance, error: 'رصيد المحفظة ما يكفي' };
  }

  const newBalance = wallet.balance - amount;

  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (updateError) return { success: false, newBalance: wallet.balance, error: 'ما زبط خصم الرصيد' };

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    phone,
    amount: -amount,
    type: 'ride_payment',
    reference: rideId,
  });

  await supabase.from('payments').insert({
    ride_id: rideId,
    phone,
    amount,
    method: 'wallet',
    status: 'paid',
  });

  return { success: true, newBalance };
}

export async function adminAdjustWallet(
  phone: string,
  amount: number,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount === 0) return { success: false, newBalance: 0, error: 'مبلغ غير صحيح' };

  const wallet = await getOrCreateWallet(phone);
  if (!wallet.id) return { success: false, newBalance: 0, error: 'ما زبط إنشاء المحفظة' };

  const newBalance = Math.max(0, wallet.balance + amount);

  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (updateError) return { success: false, newBalance: wallet.balance, error: 'ما زبط تحديث الرصيد' };

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    phone,
    amount,
    type: 'admin_adjust',
  });

  return { success: true, newBalance };
}

export async function recordCashPayment(
  rideId: string,
  phone: string,
  amount: number,
  method: 'cash' | 'cliq' | 'iban' = 'cash',
): Promise<void> {
  await supabase.from('payments').insert({
    ride_id: rideId,
    phone,
    amount,
    method,
    status: 'pending',
  });
}

export async function creditWallet(
  phone: string,
  amount: number,
  type: 'topup' | 'admin_adjust' | 'bonus' = 'bonus',
  reference?: string,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount <= 0) return { success: false, newBalance: 0, error: 'مبلغ غير صحيح' };

  const wallet = await getOrCreateWallet(phone);
  if (!wallet.id) return { success: false, newBalance: 0, error: 'ما زبط إنشاء المحفظة' };

  const newBalance = wallet.balance + amount;

  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (updateError) return { success: false, newBalance: wallet.balance, error: 'ما زبط تحديث الرصيد' };

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    phone,
    amount,
    type: type === 'bonus' ? 'topup' : type,
    reference: reference ?? null,
  });

  return { success: true, newBalance };
}

export async function getDriverContract(driverPhone: string): Promise<{
  adminPercentage: number;
  driverPercentage: number;
} | null> {
  const { data } = await supabase
    .from('driver_contracts')
    .select('admin_percentage, driver_percentage')
    .eq('driver_phone', driverPhone)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle();
  if (data) {
    return {
      adminPercentage: Number(data.admin_percentage),
      driverPercentage: Number(data.driver_percentage),
    };
  }
  return null;
}

export async function getDefaultAdminPercentage(): Promise<number> {
  const { data } = await supabase
    .from('pricing_settings')
    .select('default_admin_percentage')
    .eq('id', 1)
    .maybeSingle();
  return data?.default_admin_percentage ? Number(data.default_admin_percentage) : 20;
}

export async function recordTripEarnings(
  rideId: string,
  totalFare: number,
  adminPercentage: number,
  driverPercentage: number,
  paymentMethod: 'cash' | 'wallet',
  driverId: string | null,
  driverPhone: string | null,
  customerPhone: string | null,
): Promise<{ adminShare: number; driverShare: number }> {
  const adminShare = Math.round(totalFare * adminPercentage / 100 * 100) / 100;
  const driverShare = Math.round(totalFare * driverPercentage / 100 * 100) / 100;

  await supabase.from('trip_earnings').insert({
    ride_id: rideId,
    total: totalFare,
    admin_share: adminShare,
    driver_share: driverShare,
    admin_percentage: adminPercentage,
    payment_method: paymentMethod,
    driver_id: driverId,
    driver_phone: driverPhone,
    customer_phone: customerPhone,
  });

  return { adminShare, driverShare };
}
