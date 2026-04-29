import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    if (!WEBHOOK_URL) return res.status(500).json({ error: 'Brak Webhooka w ustawieniach Vercel!' });

    // Sprawdzamy czy użytkownik chce wysłać test (?test=true)
    const isTest = req.query.test === 'true';

    if (isTest) {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `\`[DEBUG]\` : Połączenie z Webhookiem działa poprawnie! 🚀`
            })
        });
        return res.status(200).json({ message: 'Wysłano wiadomość testową na Discord!' });
    }

    try {
        const listPath = path.join(process.cwd(), 'list.json');
        const mods = JSON.parse(fs.readFileSync(listPath, 'utf8'));
        const results = [];

        for (const mod of mods) {
            try {
                const response = await fetch(mod.link);
                const data = await response.json();
                
                if (!data || data.length === 0) continue;

                const latest = data[0]; 
                const apiVersion = latest.version_number;
                const versionName = latest.name;
                const datePublished = latest.date_published;
                const projectLink = `https://modrinth.com/project/${mod.id}/version/${latest.id}`;

                const ignoredList = mod.ignored_versions ? mod.ignored_versions.split(',').map(v => v.trim()) : [];
                if (ignoredList.includes(apiVersion)) {
                    results.push({ mod: mod.name, status: 'Ignored version', version: apiVersion });
                    continue;
                }

                const lastSent = await kv.get(`sent_id_${mod.id}`);
                if (apiVersion === lastSent) {
                    results.push({ mod: mod.name, status: 'Up to date', version: apiVersion });
                    continue;
                }

                const formattedDate = new Date(datePublished).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

                await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `\`[+]\` : **${versionName}** has been updated \`${formattedDate}\` [HERE](${projectLink})`
                    })
                });

                await kv.set(`sent_id_${mod.id}`, apiVersion);
                results.push({ mod: mod.name, status: 'SENT', version: apiVersion });

            } catch (err) {
                results.push({ mod: mod.name, error: err.message });
            }
        }
        return res.status(200).json(results);
    } catch (e) {
        return res.status(500).json({ error: 'Server Error' });
    }
}
