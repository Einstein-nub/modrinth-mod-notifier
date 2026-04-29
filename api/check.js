import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    
    if (!WEBHOOK_URL) {
        return res.status(500).json({ error: 'Brak DISCORD_WEBHOOK_URL w Environment Variables!' });
    }

    try {

        const listPath = path.join(process.cwd(), 'list.json');
        const fileContent = fs.readFileSync(listPath, 'utf8');
        const apiUrls = JSON.parse(fileContent);

        const results = [];

        for (const url of apiUrls) {
            try {
                const response = await fetch(url);
                const versions = await response.json();

                if (!versions || versions.length === 0) continue;


                const latest = versions[0];
                
                const modId = latest.project_id;
                const versionName = latest.name; 
                const datePublished = latest.date_published;
                const versionId = latest.id;
                

                const projectLink = `https://modrinth.com/project/${modId}/version/${versionId}`;

                const lastVersionId = await kv.get(`last_id_${modId}`);

                if (versionId !== lastVersionId) {

                    const date = new Date(datePublished).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

                    const message = {
                        content: `\`[+]\` : **${versionName}** has been updated \`${date}\` [HERE](${projectLink})`
                    };

                    await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(message)
                    });

                    await kv.set(`last_id_${modId}`, versionId);
                    results.push({ name: versionName, status: 'notified' });
                } else {
                    results.push({ name: versionName, status: 'up-to-date' });
                }
            } catch (err) {
                results.push({ url, error: err.message });
            }
        }

        return res.status(200).json({ success: true, results });

    } catch (error) {
        return res.status(500).json({ error: 'Błąd odczytu pliku list.json lub bazy danych.' });
    }
}
