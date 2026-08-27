import { validateScrapingUrl } from '../services/scrapingService';

function testSrfValidation() {
    console.log('🧪 [TEST FASE 2] Test validazione SSRF nello scraping...');

    const invalidUrls = [
        'http://localhost:3001/api/admin',
        'http://127.0.0.1:8080/internal',
        'http://192.168.1.1/router',
        'http://10.0.0.5/secret',
        'http://169.254.169.254/latest/meta-data',
        'ftp://example.com/file',
        'not-a-url'
    ];

    let blockedCount = 0;
    for (const url of invalidUrls) {
        try {
            validateScrapingUrl(url);
            console.error(`  ❌ ERRORE: URL non bloccato: ${url}`);
        } catch (e: any) {
            console.log(`  ✅ Correttamente bloccato [${url}]: ${e.message}`);
            blockedCount++;
        }
    }

    const validUrls = [
        'https://www.fisb.it/risultati/torneo-123',
        'http://federazione.it/classifiche'
    ];

    let allowedCount = 0;
    for (const url of validUrls) {
        try {
            const parsed = validateScrapingUrl(url);
            console.log(`  ✅ Correttamente accettato [${url}] -> Host: ${parsed.hostname}`);
            allowedCount++;
        } catch (e: any) {
            console.error(`  ❌ ERRORE: URL valido erroneamente rifiutato: ${url}`);
        }
    }

    console.log(`\n🎉 Esito test SSRF: ${blockedCount}/${invalidUrls.length} bloccati, ${allowedCount}/${validUrls.length} accettati.`);
}

testSrfValidation();
