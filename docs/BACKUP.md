# Backing up Cadence off the NAS (about 10 minutes)

Cadence already keeps daily snapshots in `data/backups/` (one database copy and one readable JSON copy per day). Those
protect you from a bad day: a wrong delete, a broken update. They don't protect you from a dead disk or a dead NAS,
because they live on the same disks. This sets up a nightly copy to somewhere else, using Synology's own backup app.

Nothing here opens the NAS to the internet, and your secrets stay on hardware you own.

## What gets backed up

The whole Cadence folder on the NAS, usually `docker/cadence/`:

| Folder / file | What it is | Why it matters |
|---|---|---|
| `data/` | your tasks, clients, plugin data, the daily snapshots in `data/backups/`, NAS fonts | everything you'd lose |
| `.env` | your password, API keys (Anthropic, Reddit, Pocket Casts…) | secrets: the backup must be encrypted |
| `certs/`, `.mkcert-ca/` | the HTTPS certificate and the private CA your devices trust | restoring these means devices don't need to re-trust a new certificate |

The code itself doesn't need backing up: it comes back from GitHub on the next deploy.

## 1. Plug in a USB drive (or pick a second NAS)

A USB drive plugged into the NAS is the simplest. Any size from 32 GB up is plenty. A second Synology somewhere else
on your network (a family member's, an old one) is better still, because it survives a fire or theft at home.

## 2. Install Hyper Backup

DSM → **Package Center** → search **Hyper Backup** → **Install**.

## 3. Create the task

1. Open **Hyper Backup** → **+** → **Data backup task**.
2. Destination: **Local folder & USB** (for the USB drive) or **Remote NAS device** (for a second Synology on your
   network). Choose the drive / NAS, then **Create backup task**, name the folder `cadence-backup`.
3. Source: tick only your Cadence folder (`docker/cadence`).
4. Applications: none needed. Click **Next**.
5. Settings:
   - **Task name**: `Cadence nightly`
   - **Enable task notification**: on (DSM tells you if a backup fails)
   - **Enable backup schedule**: daily, **3:17 AM** (after Cadence's own daily snapshot, away from the hour)
   - **Enable integrity check**: on, monthly
   - **Enable client-side encryption**: **on**. Set a password and **save the `.pem` key file it offers** somewhere
     that is not the NAS (a password manager is ideal). Without it the backup can't be opened, and it contains your
     `.env` secrets, so it must be encrypted.
6. Rotation: **Enable backup rotation** → **Smart Recycle**, keep **30** versions.
7. **Done**, and say **Yes** to "Back up now?" for the first copy.

## 4. Check it worked (once)

Hyper Backup → the task shows **Success** with a date. Click **Version List** → browse → you should see
`data/backups/cadence-YYYY-MM-DD.db` files inside.

## Restoring

- **One bad day** (you deleted something): the daily snapshots in `data/backups/` are enough. Stop the container,
  copy the snapshot you want over `data/cadence.db`, start the container.
- **Lost the NAS or the disk**: set up Cadence again with `deploy.sh` as in the README, stop the container, then
  Hyper Backup (or **Hyper Backup Explorer** on a computer, with the `.pem` key) → **Restore** → **Data** → the
  `cadence` folder back to `docker/cadence/`. Start the container. Restore from a `data/backups/*.db` snapshot rather
  than the live `data/cadence.db` if the live one looks damaged: the snapshots are always written whole.

## Optional: an off-site copy

If you want a copy that survives the house too, Hyper Backup can also send to **Synology C2** or another cloud.
That's an outbound, encrypted upload (nothing is opened to the internet), but it does put your encrypted data with
a third party. It's your call; the USB drive or a second NAS on your network is enough for most people.
