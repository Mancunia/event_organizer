import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { formatCode } from "@/lib/codes";
import { claimUrl } from "@/lib/invites";
import { env } from "@/lib/env";
import { eventKind } from "@/lib/event-kinds";
import { rsvpLabel, summariseGuests } from "@/lib/guest-status";
import {
  deleteEvent,
  deleteGuest,
  removeScanner,
  removeWhatsAppAccount,
  replaceScannerDevice,
  resendInvite,
  resendScannerLink,
  resetBinding,
} from "@/app/admin/actions";
import { Pill } from "@/components/bloom";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventForm } from "@/components/admin/EventForm";
import { AddGuestForm, ConfirmButton, ImportGuestsForm, SendAllButton } from "@/components/admin/GuestTools";
import { AddScannerForm } from "@/components/admin/ScannerTools";
import { WhatsAppAccountForm } from "@/components/admin/WhatsAppAccountForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function EventAdmin({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      guests: { orderBy: { name: "asc" }, include: { invite: { include: { checkedInBy: { select: { label: true } } } } } },
      scanners: { orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "asc" }], include: { _count: { select: { checkIns: true } } } },
    },
  });
  if (!event) notFound();
  const secrets = await db.event.findUniqueOrThrow({ where: { id }, select: { waAccessTokenEnc: true, waAppSecretEnc: true } });
  const waAccount = {
    phoneNumberId: event.waPhoneNumberId,
    hasToken: secrets.waAccessTokenEnc !== null,
    hasAppSecret: secrets.waAppSecretEnc !== null,
    verifyToken: event.waVerifyToken,
    webhookUrl: `${env.appUrl}/api/webhooks/whatsapp/${event.id}`,
  };

  const invites = event.guests.map((g) => g.invite).filter((i) => i !== null);
  const summary = summariseGuests(event.guests);
  const stats = {
    guests: summary.guests,
    people: summary.invitedPeople,
    sent: invites.filter((i) => i.sentAt).length,
    claimed: invites.filter((i) => i.claimedAt).length,
    attending: summary.attendingPeople,
    declined: summary.declined,
    checkedIn: summary.checkedIn,
  };

  return (
    <AdminShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
            ← All events
          </Link>
          <h1 className="font-script text-5xl leading-tight text-slate">{event.title}</h1>
          <Pill tone="stamp">{eventKind(event.kind).label}</Pill>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/${event.slug}`} className="btn-ghost btn-sm" target="_blank">
            Guest page
          </Link>
          <Link href={`/${event.slug}/verify`} className="btn-ghost btn-sm" target="_blank">
            Check-in page
          </Link>
          {event.clientPasswordHash && (
            <Link href={`/${event.slug}/guests`} className="btn-ghost btn-sm" target="_blank">
              Client view
            </Link>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {(
          [
            ["Guests", stats.guests],
            ["People", stats.people],
            ["Sent", stats.sent],
            ["Claimed", stats.claimed],
            ["Attending", stats.attending],
            ["Declined", stats.declined],
            ["Checked in", stats.checkedIn],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="card p-4">
            <dt className="label">{label}</dt>
            <dd className="text-3xl font-semibold text-slate">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Guests</h2>
          <SendAllButton eventId={event.id} unsent={invites.filter((i) => !i.sentAt).length} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="border-b border-hairline eyebrow text-cocoa-ink">
              <tr>
                <th className="py-2 pr-3">Guest</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">WhatsApp</th>
                <th className="py-2 pr-3">Device</th>
                <th className="py-2 pr-3">RSVP</th>
                <th className="py-2 pr-3">Check-in</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {event.guests.map((guest) => {
                const invite = guest.invite;
                const rsvp = rsvpLabel(invite, guest.partySize);
                return (
                  <tr key={guest.id} className="align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-ink">{guest.name}</p>
                      <p className="text-xs text-ink-muted">
                        {guest.phone} · party of {guest.partySize}
                      </p>
                      {guest.notes && <p className="text-xs italic text-ink-muted">{guest.notes}</p>}
                    </td>
                    <td className="py-3 pr-3 font-mono">
                      {invite && (
                        <a href={claimUrl(event.slug, invite.code)} className="text-slate hover:underline" title="Claim link">
                          {formatCode(invite.code)}
                        </a>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {invite?.sendStatus ? (
                        <span title={invite.sendError ?? undefined}>
                          <Pill tone={invite.sendStatus === "failed" ? "declined" : "attending"}>{invite.sendStatus}</Pill>
                          {invite.sentAt && <span className="mt-1 block text-xs text-ink-muted">{shortDate(invite.sentAt)}</span>}
                        </span>
                      ) : (
                        <Pill>not sent</Pill>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {invite?.claimedAt ? (
                        <span title={invite.claimUserAgent ?? undefined}>
                          <Pill tone="attending">bound</Pill>
                          <span className="mt-1 block text-xs text-ink-muted">{shortDate(invite.claimedAt)}</span>
                        </span>
                      ) : (
                        <Pill>unclaimed</Pill>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={rsvp.tone}>{rsvp.label}</Pill>
                    </td>
                    <td className="py-3 pr-3">
                      {invite?.checkedInAt ? (
                        <>
                          {shortDate(invite.checkedInAt)}
                          {invite.checkedInBy && <span className="block text-xs text-ink-muted">{invite.checkedInBy.label}</span>}
                        </>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {invite && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <ConfirmButton
                            action={resendInvite.bind(null, event.id, invite.id)}
                            label={invite.sentAt ? "Resend" : "Send"}
                            confirmText={`Send the WhatsApp invite to ${guest.name}?`}
                          />
                          {invite.claimedAt && (
                            <ConfirmButton
                              action={resetBinding.bind(null, event.id, invite.id)}
                              label="Reset device"
                              confirmText={`Unlock ${guest.name}'s invite so it can be claimed on a new device? Their current device will lose access.`}
                            />
                          )}
                          <ConfirmButton
                            action={deleteGuest.bind(null, event.id, guest.id)}
                            label="Remove"
                            confirmText={`Remove ${guest.name} from the guest list? Their code will stop working.`}
                            className="btn-ghost btn-sm hover:border-terracotta"
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {event.guests.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No guests yet.</p>}
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Scanner devices</h2>
          <p className="text-sm text-ink-muted">
            Each staff member gets a one-time WhatsApp link that turns their phone into a check-in scanner and walks them through using it.
            The link works on the first phone that opens it. Needs an approved template named <code>{event.scannerTemplateName}</code> with
            four body variables: staff name, event title, device label, link.
          </p>
        </div>
        <AddScannerForm eventId={event.id} />
        {event.scanners.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-hairline eyebrow text-cocoa-ink">
                <tr>
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">WhatsApp</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 pr-3">Check-ins</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {event.scanners.map((device) => {
                  const expired = !device.boundAt && device.tokenExpiresAt <= new Date();
                  return (
                    <tr key={device.id} className={`align-top ${device.revokedAt ? "opacity-60" : ""}`}>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-ink">{device.label}</p>
                        <p className="text-xs text-ink-muted">
                          {device.staffName} · {device.phone}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        {device.sendStatus ? (
                          <span title={device.sendError ?? undefined}>
                            <Pill tone={device.sendStatus === "failed" ? "declined" : "attending"}>{device.sendStatus}</Pill>
                            {device.sentAt && <span className="mt-1 block text-xs text-ink-muted">{shortDate(device.sentAt)}</span>}
                          </span>
                        ) : (
                          <Pill>not sent</Pill>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {device.revokedAt ? (
                          <Pill tone="declined">removed</Pill>
                        ) : device.boundAt ? (
                          <span title={device.boundUserAgent ?? undefined}>
                            <Pill tone="attending">set up</Pill>
                            <span className="mt-1 block text-xs text-ink-muted">{shortDate(device.boundAt)}</span>
                          </span>
                        ) : expired ? (
                          <Pill tone="declined">link expired</Pill>
                        ) : (
                          <Pill>waiting for setup</Pill>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {device.lastSeenAt ? shortDate(device.lastSeenAt) : <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="py-3 pr-3">{device._count.checkIns}</td>
                      <td className="py-3">
                        {!device.revokedAt && (
                          <div className="flex flex-wrap justify-end gap-2">
                            {!device.boundAt && (
                              <ConfirmButton
                                action={resendScannerLink.bind(null, event.id, device.id)}
                                label="Resend link"
                                confirmText={`Send ${device.staffName} a fresh setup link? The previous link will stop working.`}
                              />
                            )}
                            {device.boundAt && (
                              <ConfirmButton
                                action={replaceScannerDevice.bind(null, event.id, device.id)}
                                label="New phone"
                                confirmText={`Remove the current ${device.label} phone and send ${device.staffName} a new setup link?`}
                              />
                            )}
                            <ConfirmButton
                              action={removeScanner.bind(null, event.id, device.id)}
                              label="Remove"
                              confirmText={`Remove ${device.label} (${device.staffName})? That phone stops working as a scanner immediately.`}
                              className="btn-ghost btn-sm hover:border-terracotta"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="text-xl font-semibold">Add a guest</h2>
          <AddGuestForm eventId={event.id} />
        </section>
        <section className="card space-y-4">
          <h2 className="text-xl font-semibold">Import from CSV</h2>
          <ImportGuestsForm eventId={event.id} />
        </section>
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">WhatsApp account</h2>
          {waAccount.phoneNumberId ? <Pill tone="attending">client&apos;s own account</Pill> : <Pill>platform account</Pill>}
        </div>
        <p className="text-sm text-ink-muted">
          Send this event&apos;s invites from the client&apos;s own WhatsApp Business number. Their account needs an approved template
          named <code>{event.messageTemplateName}</code> ({event.templateLanguage}) with four body variables: guest name, event title,
          code, link. Leave this empty to send from the platform account.
        </p>
        <WhatsAppAccountForm eventId={event.id} account={waAccount} />
        {waAccount.phoneNumberId && (
          <ConfirmButton
            action={removeWhatsAppAccount.bind(null, event.id)}
            label="Disconnect account"
            confirmText="Remove the client's WhatsApp credentials? Invites will go out from the platform account again."
            className="btn-ghost btn-sm hover:border-terracotta"
          />
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Event details & theme</h2>
        <EventForm event={event} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Delete event</h2>
        <p className="text-sm text-ink-muted">
          Permanently removes this event, all {stats.guests} guest{stats.guests === 1 ? "" : "s"} and their invites. Invite codes stop working
          immediately. This cannot be undone.
        </p>
        <ConfirmButton
          action={deleteEvent.bind(null, event.id)}
          label="Delete event"
          confirmText={`Delete ${event.title} and all ${stats.guests} guest${stats.guests === 1 ? "" : "s"}? This cannot be undone.`}
          className="btn-ghost btn-sm hover:border-terracotta"
        />
      </section>
    </AdminShell>
  );
}
