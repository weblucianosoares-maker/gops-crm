const Papa = require('papaparse');

const csvString = `First Name,Middle Name,Last Name,Phonetic First Name,Phonetic Middle Name,Phonetic Last Name,Name Prefix,Name Suffix,Nickname,File As,Organization Name,Organization Title,Organization Department,Birthday,Notes,Photo,Labels,E-mail 1 - Label,E-mail 1 - Value,E-mail 2 - Label,E-mail 2 - Value,E-mail 3 - Label,E-mail 3 - Value,Phone 1 - Label,Phone 1 - Value,Phone 2 - Label,Phone 2 - Value,Phone 3 - Label,Phone 3 - Value,Phone 4 - Label,Phone 4 - Value,Address 1 - Label,Address 1 - Formatted,Address 1 - Street,Address 1 - City,Address 1 - PO Box,Address 1 - Region,Address 1 - Postal Code,Address 1 - Country,Address 1 - Extended Address,Address 2 - Label,Address 2 - Formatted,Address 2 - Street,Address 2 - City,Address 2 - PO Box,Address 2 - Region,Address 2 - Postal Code,Address 2 - Country,Address 2 - Extended Address,Relation 1 - Label,Relation 1 - Value,Website 1 - Label,Website 1 - Value
- Renata,,Krawczyk,,,,,,,,,,,,,,* myContacts,* Other,renata.kra@hotmail.com,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
[NÃƒO QUER CONTATO] Wermmeson,,,,,,,,,,Ø£Ù†Ø§ Ø§Ø¨Ù† Ø§Ù„Ù„Ù‡,,,,,,* myContacts,,,,,,,Mobile,+55 73 99446-838,,,,,,,,,,,,,,,,,,,,,,,,,,,,
[SEM INTERESSE] Miguel,,Ã‚ngelo,,,,,,,,,,,,,,* myContacts,,,,,,,Mobile,+55 21 99718-2255,,,,,,,,,,,,,,,,,,,,,,,,,,,,
*,CI3 - RFWS3 - LLQI - Cristian,Moura,,,,,,,,,,,,,,Preencheu For Wk3 ::: * myContacts ::: * starred,,,,,,,,66992221146,,,,,,,,,,,,,,,,,,,,,,,,,,,,
*,,RFWS3 - LLQI - Ricardo,,,,,,,,,,,,,,Grupo 1 ::: Preencheu For Wk3 ::: * myContacts,,,,,,,,062 99317-9018,,,,,,,,,,,,,,,,,,,,,,,,,,,,
A,,F,,,,,,,,,,,1984-11-13,,,* myContacts,* Other,Special-Mustang@hotmail.it,,,,,,338-4255301,Home,02-36508254,Mobile,+55 33 98425-5301,,,Home,"Milano  MI
Italia",,,,Milano  MI,,Italia,,,,,,,,,,,,,,
AA-LKAP -  Adailton,,,,,,,,,,,Analista,,,,https://lh3.googleusercontent.com/contacts/AG...`;

try {
  Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
            const parsedData = results.data
              .filter(row => Object.keys(row).length > 1 && (row['First Name'] || row.Name || row.Nome || row['E-mail 1 - Value'] || row.name))
              .map(row => {
                let rawName = row.name || row.Nome || row.Name || '';
                if (!rawName) {
                  const parts = [row['First Name'], row['Middle Name'], row['Last Name']].filter(Boolean);
                  rawName = parts.join(' ');
                }
                
                rawName = rawName.replace(/NÃƒO/gi, 'NÃO').replace(/Ã‚/gi, 'Â').replace(/Ãµ/gi, 'õ').replace(/Ã©/gi, 'é').replace(/Ã£/gi, 'ã');
                rawName = rawName.replace(/^[*#,]/g, '').trim();
                if (rawName.startsWith('- ')) rawName = rawName.substring(2).trim();

                let status = row.status || row.Status || 'Novo';
                const nameUpper = rawName.toUpperCase();
                if (nameUpper.includes('NÃO TEM INTERESSE') || nameUpper.includes('SEM INTERESSE') || nameUpper.includes('NÃO QUER CONTATO')) {
                  status = 'Desqualificado';
                }
                rawName = rawName.replace(/^\[.*?\]\s*/, '').trim();
                if (!rawName) rawName = 'Sem Nome';

                const email = row.email || row.Email || row['E-mail 1 - Value'] || '';

                let source = row.source || row.Origem || 'Google Contacts';
                if (row.Labels) {
                  const labels = row.Labels.split(':::').map((l) => l.trim().replace('* ', ''));
                  const validLabels = labels.filter((l) => l !== 'myContacts' && l !== 'Other' && l !== 'starred');
                  if (validLabels.length > 0) source = validLabels[0];
                }

                let initials = row.initials || row.Iniciais || '';
                if (!initials) {
                  const parts = rawName.split(' ').filter(Boolean);
                  if (parts.length > 1) {
                    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                  } else if (rawName !== 'Sem Nome') {
                    initials = rawName.substring(0, 2).toUpperCase();
                  } else {
                    initials = 'SN';
                  }
                }

                return {
                  name: rawName,
                  email: email,
                  source: source,
                  status: status,
                  lastcontact: row.lastContact || row['Último Contato'] || '2024-01-01',
                  initials: initials,
                  birthday: row.birthday === 'true' || row.Aniversário === 'true' || !!row.Birthday
                };
              });
              console.log('Success!', parsedData);
      } catch (err) {
        console.error('JS THROWN ERROR IN MAP:', err);
      }
    }
  });
} catch(e) {
  console.log('SYNC ERROR:', e);
}
