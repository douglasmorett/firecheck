const fs = require('fs');

const filePath = 'C:/Users/FINANCEIRO/Documents/FireCheck/src/pages/LandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = "        {/* Right Column: Animated Dual Phones */}";
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf("      </section>\r\n\r\n      {/* Templates de Checklist */}");

if (startIndex === -1 || endIndex === -1) {
  console.log("Markers not found!");
  process.exit(1);
}

// Extract the mockup code
const mockupCode = content.substring(startIndex, endIndex);

// Replacement for Hero section
const videoPlaceholder = `        {/* Right Column: Video Placeholder */}
        <div className="hero-mockups" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: '450px', background: 'var(--bg-card)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
           <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
             <Video size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
             <p style={{ fontWeight: 'bold' }}>Vídeo de Demonstração (Aguardando)</p>
           </div>
        </div>
      </div>`;

// Insert point after Templates de Checklist
const templatesEndMarker = "        </div>\r\n      </section>";
let newContent = content.substring(0, startIndex) + videoPlaceholder + content.substring(endIndex + 16 /* length of </section> */);

// Now we need to find where Templates de Checklist ends in the newContent
const templatesEndIndex = newContent.indexOf(templatesEndMarker, startIndex);

if (templatesEndIndex !== -1) {
  const insertIndex = templatesEndIndex + templatesEndMarker.length;
  
  const newSection = `

      {/* NOVA SEÇÃO: Processo Simples */}
      <section className="section-mobile-padding" style={{ padding: '80px 0', backgroundColor: 'var(--bg-color)', position: 'relative', zIndex: 11, overflow: 'hidden' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 5%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'min(2.5rem, 5vw)', fontWeight: '900', marginBottom: '16px', color: 'var(--text-main)' }}>Veja como é <span style={{ color: '#ff4d00' }}>simples o nosso processo</span></h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>Do celular do funcionário para o seu bolso em segundos.</p>
          </div>
        </div>
${mockupCode.replace("veja como é simples o nosso processo:", "")}
      </section>
`;

  newContent = newContent.substring(0, insertIndex) + newSection + newContent.substring(insertIndex);
  fs.writeFileSync(filePath, newContent);
  console.log("Success!");
} else {
  console.log("Templates end marker not found");
}
