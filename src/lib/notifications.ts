import db from '@/lib/database';

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: 'urgent' | 'info' | 'warning' = 'info',
  link?: string
) {
  try {
    await db.prepare(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, title, message, type, link || null);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export async function notifyUsers(
  userEmails: string[],
  title: string,
  message: string,
  type: 'urgent' | 'info' | 'warning' = 'info',
  link?: string
) {
  if (!userEmails.length) return;
  const placeholders = userEmails.map(() => '?').join(',');
  const users = await db.prepare(`SELECT id FROM users WHERE email IN (${placeholders})`).all(...userEmails) as any[];
  for (const user of users) {
    await createNotification(user.id, title, message, type, link);
  }
}
