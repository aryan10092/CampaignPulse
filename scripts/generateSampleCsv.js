const fs = require('fs');
const path = require('path');

const count = parseInt(process.argv[2] || '1000', 10);
const outputPath = path.join(__dirname, '..', 'sample-customers.csv');

const firstNames = ['Aarav', 'Aryan', 'Ananya', 'Rohan', 'Priya', 'Aditya', 'Sneha', 'Vikram', 'Neha', 'Rahul', 'Pooja', 'Amit', 'Divya', 'Siddharth', 'Tanvi'];
const lastNames = ['Sharma', 'Patel','Gupta', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Nair', 'Reddy', 'Chopra', 'Rao', 'Iyer', 'Das'];
const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com', 'company.org'];

console.log(`Generating sample CSV with ${count} customers...`);

const writeStream = fs.createWriteStream(outputPath);
writeStream.write('name,email\n');

for (let i = 1; i <= count; i++) {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const fullName = `${firstName} ${lastName}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`;

  writeStream.write(`"${fullName}","${email}"\n`);
}

writeStream.end(() => {
  console.log(`✅ Generated ${count} sample customers at: ${outputPath}`);
});
