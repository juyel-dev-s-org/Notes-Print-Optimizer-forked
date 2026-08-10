/**
 * Generates realistic sample Physics Wallah class note slides
 * as HTMLCanvasElement/ImageData for zero-config testing.
 */

export class SamplePdfGenerator {
  public static async generateSamplePWDoc(): Promise<Uint8Array> {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();

    const slides = this.createSampleSlides();

    for (const slide of slides) {
      const dataUrl = slide.canvas.toDataURL('image/jpeg', 0.85);
      // Decode base64 directly — fetch() on data: URLs is blocked in Chromium
      // (CSP connect-src + Fetch API restriction).
      const bin = atob(dataUrl.split(',')[1]);
      const imageBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) imageBytes[i] = bin.charCodeAt(i);
      const embeddedImage = await pdfDoc.embedJpg(imageBytes);

      const page = pdfDoc.addPage([slide.canvas.width, slide.canvas.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: slide.canvas.width,
        height: slide.canvas.height,
      });
    }

    return await pdfDoc.save();
  }

  public static createSampleSlides(): { title: string; canvas: HTMLCanvasElement }[] {
    const slides: { title: string; canvas: HTMLCanvasElement }[] = [];

    // Slide 1: PW Dark Mode Whiteboard - Motion in 1D
    slides.push({
      title: 'Slide 1: PW Dark Mode (Kinematics)',
      canvas: this.drawSlide1(),
    });

    // Slide 2: PW Dark Mode - Circuit Diagram
    slides.push({
      title: 'Slide 2: PW Dark Mode (Circuits)',
      canvas: this.drawSlide2(),
    });

    // Slide 3: Light Mode Handwritten Notes
    slides.push({
      title: 'Slide 3: Light Mode Handwritten',
      canvas: this.drawSlide3(),
    });

    // Slide 4: PW Dark Mode - Problem Set
    slides.push({
      title: 'Slide 4: PW Dark Mode (Practice Qs)',
      canvas: this.drawSlide4(),
    });

    return slides;
  }

  private static drawSlide1(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    // Black/Dark Navy background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 1280, 720);

    // Top PW Banner (Dark Navy/Red accent bar)
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, 1280, 70);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(0, 66, 1280, 4);

    // PW Logo Text in Banner
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PHYSICS WALLAH', 30, 42);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px sans-serif';
    ctx.fillText('LAKSHYA JEE 2026  •  Physics - Motion in 1D  •  Lecture 04', 300, 42);

    // Bottom PW Footer Banner
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 670, 1280, 50);
    ctx.fillStyle = '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText('PW App Official Class Notes  |  Do Not Share  |  Batch ID: LK2026-JEE', 30, 700);

    // Whiteboard Content
    // Main Title in Yellow Pen
    ctx.fillStyle = '#FACC15'; // Bright PW Yellow Pen
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Equations of Uniformly Accelerated Motion', 50, 130);

    // White Handwritten Text
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '24px monospace';
    ctx.fillText('1. Velocity-Time Relation:', 50, 190);

    // Yellow Formula Box
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.strokeRect(380, 160, 240, 50);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('v = u + at', 420, 195);

    // Cyan Pen for Displacement
    ctx.fillStyle = '#38BDF8'; // Bright Cyan Pen
    ctx.font = '24px monospace';
    ctx.fillText('2. Position-Time Relation:', 50, 260);

    ctx.strokeStyle = '#38BDF8';
    ctx.strokeRect(380, 230, 320, 50);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('s = ut + ½ at²', 420, 265);

    // Lime Green Pen for Derivation
    ctx.fillStyle = '#4ADE80'; // Lime Green
    ctx.font = '22px sans-serif';
    ctx.fillText('Derivation via Integration:', 50, 340);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px monospace';
    ctx.fillText('a = dv/dt   ⇒   dv = a · dt', 80, 385);
    ctx.fillText('∫ dv = ∫ a · dt  (from 0 to t)', 80, 425);
    ctx.fillText('v - u = a(t - 0)   ⇒   v = u + at  [PROVED]', 80, 465);

    // Graph Diagram on Right Side
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    // Axes
    ctx.beginPath();
    ctx.moveTo(850, 500);
    ctx.lineTo(850, 200);
    ctx.lineTo(1200, 500);
    ctx.stroke();

    // Graph Labels
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '18px sans-serif';
    ctx.fillText('Velocity (v)', 820, 180);
    ctx.fillText('Time (t)', 1200, 525);

    // Line in Pink Pen
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(850, 420);
    ctx.lineTo(1150, 250);
    ctx.stroke();

    // Initial Velocity 'u'
    ctx.fillStyle = '#F472B6';
    ctx.fillText('u', 825, 425);
    ctx.fillText('v', 825, 250);

    return canvas;
  }

  private static drawSlide2(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    // Black background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 1280, 720);

    // Banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 1280, 60);
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(0, 56, 1280, 4);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('PHYSICS WALLAH  •  Current Electricity', 30, 38);

    // Title
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText("Kirchhoff's Current Law (KCL) & Junction Rule", 50, 120);

    // White explanation
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '22px sans-serif';
    ctx.fillText('Sum of currents entering a junction = Sum of currents leaving the junction', 50, 170);

    // Circuit Diagram in Cyan and Lime
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    // Central junction point
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(450, 360, 12, 0, Math.PI * 2);
    ctx.fill();

    // Incoming wires
    ctx.beginPath();
    ctx.moveTo(200, 240);
    ctx.lineTo(450, 360);
    ctx.moveTo(200, 480);
    ctx.lineTo(450, 360);
    ctx.stroke();

    // Outgoing wires
    ctx.strokeStyle = '#4ADE80';
    ctx.beginPath();
    ctx.moveTo(450, 360);
    ctx.lineTo(700, 240);
    ctx.moveTo(450, 360);
    ctx.lineTo(700, 480);
    ctx.moveTo(450, 360);
    ctx.lineTo(720, 360);
    ctx.stroke();

    // Currents labels
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('I₁ = 5A →', 180, 220);
    ctx.fillText('I₂ = 3A →', 180, 510);

    ctx.fillStyle = '#4ADE80';
    ctx.fillText('→ I₃ = 2A', 720, 230);
    ctx.fillText('→ I₄ = 4A', 740, 365);
    ctx.fillText('→ I₅ = ?', 720, 510);

    // Equation Box on Right
    ctx.strokeStyle = '#FACC15';
    ctx.strokeRect(860, 280, 360, 180);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('∑ I_in = ∑ I_out', 880, 330);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '22px monospace';
    ctx.fillText('5 + 3 = 2 + 4 + I₅', 880, 380);
    ctx.fillStyle = '#4ADE80';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('I₅ = 8 - 6 = 2 A', 880, 430);

    return canvas;
  }

  private static drawSlide3(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    // Slightly dirty off-white background simulating scanned paper
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, 0, 1280, 720);

    // Top banner
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, 1280, 50);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PHYSICS WALLAH  •  Organic Chemistry - SN1 Reaction Mechanism', 30, 32);

    // Dark Pen Ink
    ctx.fillStyle = '#1E1B4B'; // Dark Navy Blue Ink
    ctx.font = 'bold 28px serif';
    ctx.fillText('Topic: SN1 Nucleophilic Substitution Reaction', 50, 110);

    ctx.font = '22px sans-serif';
    ctx.fillText('Step 1: Formation of Carbocation (Slow / Rate Determining Step)', 50, 165);

    // Chemical equation
    ctx.font = 'bold 24px monospace';
    ctx.fillText('R—X   ─(slow)─►   R⁺  +  X⁻', 80, 220);

    ctx.font = '22px sans-serif';
    ctx.fillText('Step 2: Attack of Nucleophile (Fast Step)', 50, 290);
    ctx.font = 'bold 24px monospace';
    ctx.fillText('R⁺  +  Nu⁻   ─(fast)─►   R—Nu', 80, 345);

    // Key Features list
    ctx.fillStyle = '#991B1B'; // Red Pen for Key Notes
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Important Characteristics:', 50, 420);

    ctx.fillStyle = '#1E1B4B';
    ctx.font = '20px sans-serif';
    ctx.fillText('• Order of reaction = 1  (First Order Kinetics)', 80, 460);
    ctx.fillText('• Rate = k [Substrate]¹ [Nucleophile]⁰', 80, 500);
    ctx.fillText('• Rearrangement of carbocation possible (1,2-hydride / methyl shift)', 80, 540);
    ctx.fillText('• Favoured by Polar Protic Solvents (H₂O, EtOH, CH₃COOH)', 80, 580);

    return canvas;
  }

  private static drawSlide4(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    // Dark Mode background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, 1280, 720);

    // Banner
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 1280, 60);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, 56, 1280, 4);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('PHYSICS WALLAH  •  Rotational Mechanics Practice Sheet', 30, 38);

    // Question Box in Yellow
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 90, 1200, 130);

    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Question 04 (JEE Advanced Pattern):', 60, 125);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '20px sans-serif';
    ctx.fillText(
      'A uniform solid sphere of mass M and radius R rolls without slipping down an inclined plane of angle θ.',
      60,
      160
    );
    ctx.fillText('Find its linear acceleration (a) along the incline.', 60, 195);

    // Solution in Cyan & White
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Solution & Concept:', 40, 260);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '20px monospace';
    ctx.fillText('Torque about C.O.M:  τ = I · α', 60, 310);
    ctx.fillText('f_s · R = (⅖ M R²) · (a / R)', 60, 350);
    ctx.fillText('f_s = ⅖ M a', 60, 390);

    ctx.fillText('Force equation along incline:  Mg sin θ - f_s = M a', 60, 440);
    ctx.fillText('Mg sin θ - ⅖ M a = M a', 60, 480);

    // Final answer in Green Box
    ctx.strokeStyle = '#4ADE80';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 520, 450, 70);

    ctx.fillStyle = '#4ADE80';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('a = (5/7) g sin θ', 90, 565);

    return canvas;
  }
}
