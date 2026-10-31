import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, formatTime } from '../ui';

interface Entry {
  id: number;
  actor_name: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const TABLE_LABEL: Record<string, string> = {
  profiles: 'Foydalanuvchi',
  communities: 'Guruh',
  community_members: 'Guruh a\'zosi',
  community_moderators: 'Moderator',
  library_items: 'Kutubxona',
  assignments: 'Topshiriq',
  suggestions: 'Taklif',
  issue_reports: 'Xato xabari',
  app_settings: 'Sozlama',
  admin_site: 'Admin sayti',
};
const ACTION_LABEL: Record<string, string> = { insert: 'qo\'shdi', update: 'o\'zgartirdi', delete: 'o\'chirdi', login: 'kirdi' };

const brief = (d: Record<string, unknown>) =>
  Object.entries(d)
    .filter(([k, v]) => v !== null && !['id', 'created_at', 'updated_at', 'invite_code', 'created_by'].includes(k))
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`.slice(0, 60))
    .join(' · ');

export const AuditPage: React.FC = () => {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, actor_name, action, target_table, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => (err ? setError(true) : setRows((data ?? []) as Entry[])));
  }, []);

  return (
    <Card title="Jurnal: kim, qachon, nima qilgan (oxirgi 200 ta)">
      {error ? (
        <p className="text-sm text-rose-600">Jurnalni yuklab bo'lmadi.</p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Hali yozuv yo'q.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border first:border-0 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">{formatTime(r.created_at)}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap font-medium">{r.actor_name ?? '-'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {ACTION_LABEL[r.action] ?? r.action} · {TABLE_LABEL[r.target_table ?? ''] ?? r.target_table}
                  </td>
                  <td className="py-1.5 text-xs text-muted-foreground">{brief(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
