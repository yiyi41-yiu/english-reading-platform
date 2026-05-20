import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

export async function seedDatabase(existingSqlite?: Database.Database): Promise<void> {
  const DB_PATH = process.env.DATABASE_URL || "./data/app.db";
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let sqlite: Database.Database;
  let closeOnExit = false;
  if (existingSqlite) {
    sqlite = existingSqlite;
  } else {
    sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    closeOnExit = true;
  }
  const db = drizzle(sqlite, { schema }) as BetterSQLite3Database<typeof schema>;

function tokenizeContent(text: string) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  return paragraphs.map((p, i) => {
    const words = p.split(/(\s+)/).filter(w => w.trim()).map(w => {
      const clean = w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
      return { word: w, clean };
    });
    return { index: i, text: p.trim(), words };
  });
}

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'teacher')),
    is_guest INTEGER NOT NULL DEFAULT 0,
    guest_id TEXT,
    api_key TEXT,
    api_provider TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    grade_level TEXT NOT NULL CHECK(grade_level IN ('primary', 'middle', 'high', 'cet4', 'cet6', 'tem4', 'tem8', 'ielts', 'toefl')),
    category TEXT NOT NULL CHECK(category IN ('narrative', 'argumentative', 'news', 'academic')),
    author TEXT,
    background TEXT,
    source TEXT,
    source_type TEXT NOT NULL DEFAULT 'seed' CHECK(source_type IN ('seed', 'teacher', 'student')),
    word_count INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    word_type TEXT,
    pronunciation TEXT,
    affixes TEXT,
    derivatives TEXT,
    article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
    interval REAL NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review TEXT,
    last_reviewed TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, word)
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('detail', 'main_idea', 'cloze', 'grammar')),
    question TEXT NOT NULL,
    options TEXT,
    answer TEXT NOT NULL,
    explanation TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercise_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    user_answer TEXT,
    is_correct INTEGER,
    attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reading_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    completed INTEGER NOT NULL DEFAULT 0,
    score REAL,
    read_at TEXT,
    UNIQUE(user_id, article_id)
  );

  CREATE TABLE IF NOT EXISTS ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    operation TEXT NOT NULL,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    input_hash TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS excerpts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    note TEXT,
    paragraph_index INTEGER NOT NULL DEFAULT 0,
    start_offset INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wrong_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options TEXT,
    grammar_analysis TEXT,
    retried INTEGER NOT NULL DEFAULT 0,
    retried_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

  // Migrations: add columns that may not exist in older DBs
  const addColumn = (table: string, col: string, def: string) => {
    const cols = (sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>).map((c) => c.name);
    if (!cols.includes(col)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`  Migrated: ${table}.${col}`);
    }
  };
  addColumn("users", "is_guest", "INTEGER NOT NULL DEFAULT 0");
  addColumn("users", "guest_id", "TEXT");
  addColumn("users", "api_key", "TEXT");
  addColumn("users", "api_provider", "TEXT");
  addColumn("articles", "source_type", "TEXT NOT NULL DEFAULT 'seed'");
  addColumn("vocabulary", "example_sentence", "TEXT");
  // pets table: create if missing
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      stage INTEGER NOT NULL DEFAULT 0,
      happiness INTEGER NOT NULL DEFAULT 80,
      experience INTEGER NOT NULL DEFAULT 0,
      last_fed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Social tables: create if missing
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "groups" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      grade_level TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      member_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS activity_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER,
      activity_type TEXT NOT NULL,
      target_id INTEGER,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // wrong_answers table: create if missing
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS wrong_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      user_answer TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL,
      options TEXT,
      grammar_analysis TEXT,
      retried INTEGER NOT NULL DEFAULT 0,
      retried_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  async function seed() {
    // Check if articles already exist — if so, skip seeding
    const existingCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM articles").get() as { cnt: number };
    if (existingCount.cnt > 0) {
      console.log(`Database already has ${existingCount.cnt} articles — skipping seed.`);
      return;
    }
    console.log("Seeding database...");

    // Create demo users
  const teacherHash = await bcrypt.hash("teacher123", 10);
  const studentHash = await bcrypt.hash("student123", 10);

  const existingTeacher = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("teacher@demo.com");
  if (!existingTeacher) {
    sqlite.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)").run(
      "teacher@demo.com", teacherHash, "Teacher Wang", "teacher"
    );
  }

  const existingStudent = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("student@demo.com");
  if (!existingStudent) {
    sqlite.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)").run(
      "student@demo.com", studentHash, "Student Li", "student"
    );
  }

  // Demo articles — 18 articles covering all 9 grade levels
  const articles = [
    // ===== PRIMARY (1 article) =====
    {
      title: "The Lion and the Mouse",
      grade_level: "primary",
      category: "narrative",
      author: "Aesop",
      background: "## About the Author\n\nAesop was a Greek storyteller who lived around 600 BCE. His fables use animal characters to teach important life lessons that are easy for children to understand.\n\n## Story Background\n\nThis famous fable shows that kindness is never wasted. Even the smallest friend can become the greatest helper when you least expect it.",
      source: "Aesop's Fables",
      content: `Once upon a time, a mighty lion was sleeping peacefully in the warm afternoon sun. A tiny mouse, scurrying about looking for food, accidentally ran across the lion's nose and woke him up with a start.

The lion was furious at being disturbed. He swiftly caught the little mouse under his enormous paw and was about to swallow her in one bite. "Please, please let me go!" begged the mouse, trembling with fear. "If you spare my life today, I promise I will help you someday when you need it most."

The lion was so amused by this ridiculous idea that he roared with laughter. "You? Help me? I am the king of the forest!" But he was feeling generous, so he lifted his paw and let the tiny creature run away into the tall grass.

Several days later, the lion was hunting in the forest when he suddenly fell into a hunter's trap. Strong ropes wrapped tightly around his body, and no matter how hard he struggled, he could not break free. His mighty roar echoed through the trees, reaching the ears of every animal nearby.

The little mouse recognized the lion's voice immediately. She rushed to the trap and began gnawing through the thick ropes with her small but very sharp teeth. One by one, the ropes snapped until the great lion was completely free.

"You laughed when I said I would help you," said the little mouse gently. "Now you understand that even the smallest creature can be a powerful friend." From that day forward, the mighty lion and the tiny mouse were the best of friends.`,
    },
    // ===== MIDDLE SCHOOL (2 articles) =====
    {
      title: "The Importance of Protecting Our Oceans",
      grade_level: "middle",
      category: "argumentative",
      author: "Marine Conservation Society",
      background: "## Background\n\nOceans cover more than 70% of our planet's surface and produce over half of the world's oxygen. They are home to millions of different species and provide food for billions of people.\n\n## Key Terms\n\n- **Ecosystem**: A community of living organisms interacting with their environment\n- **Microplastics**: Tiny plastic particles less than 5mm in size that pollute the water\n- **Marine biodiversity**: The variety of life found in the ocean",
      source: "Adapted from Marine Conservation Society publications",
      content: `Our oceans are in serious trouble, and this affects every single person on Earth. Every year, approximately eight million tons of plastic waste enters the ocean. That is equivalent to dumping one full garbage truck of plastic into the sea every single minute. If this trend continues, scientists predict that by 2050, there will be more plastic in the ocean than fish by weight.

Plastic pollution harms marine life in countless ways. Sea turtles mistake floating plastic bags for jellyfish and eat them, which can block their digestive systems and cause them to starve. Seabirds feed plastic pieces to their chicks, not realizing these indigestible materials will kill their young. Whales have been found dead with stomachs full of plastic bottles and bags. Even tiny plankton at the bottom of the food chain are consuming microplastics, which then travel up through the entire marine food web.

The consequences extend far beyond the ocean itself. When fish consume microplastics, the toxic chemicals from those plastics can accumulate in their bodies. When humans eat those fish, these toxins enter our bodies too. Scientists are still studying the long-term health effects, but early research suggests links to hormone disruption and other health problems.

Fortunately, there is still hope. Countries around the world are taking action to reduce plastic waste. Many nations have banned single-use plastic bags and straws. Beach cleanup events organized by local communities remove tons of trash from coastlines every year. New technologies are being developed to clean up plastic from the open ocean using special floating barriers.

But real change starts with each of us. By choosing reusable bags, bottles, and containers instead of disposable plastic ones, we can dramatically reduce our personal plastic footprint. When we recycle properly, we ensure that plastic waste gets turned into new products rather than ending up in the ocean. Every small action, multiplied by millions of people, can make an enormous difference for the health of our blue planet.`,
    },
    {
      title: "The Amazing Journey of Monarch Butterflies",
      grade_level: "middle",
      category: "narrative",
      author: "National Geographic Kids",
      background: "## Background\n\nMonarch butterflies are among the most recognizable insects in the world, known for their striking orange and black wing patterns. But their true claim to fame is their extraordinary annual migration.\n\n## Did You Know?\n\n- Monarchs only weigh about as much as a paperclip\n- They can fly up to 100 miles in a single day\n- The migration takes multiple generations to complete\n- Monarchs use the position of the sun to navigate",
      source: "Adapted from National Geographic",
      content: `Every autumn, one of nature's most spectacular journeys takes place across North America. Millions of monarch butterflies, each weighing less than a single paperclip, begin an incredible migration that can span up to 3,000 miles. These delicate insects travel from Canada and the northern United States all the way to the mountain forests of central Mexico, where they spend the winter clustered together on oyamel fir trees.

What makes this migration truly remarkable is that no single butterfly completes the entire round trip. The journey south is made by a special generation of monarchs that lives up to eight months—far longer than the typical two to six weeks of summer monarchs. This "Methuselah generation" flies the entire distance to Mexico, survives the winter, and then begins the journey north in spring.

However, these long-lived butterflies only make it partway back. They stop to lay eggs on milkweed plants, and then die. Their offspring continue north, living only a few weeks each but covering more of the journey. It takes three to five generations to complete the full return trip. Somehow, each new generation knows exactly where to go without ever having been there before.

Scientists believe monarchs navigate using a combination of methods. They have an internal "sun compass" that tracks the sun's position in the sky, adjusting for the time of day using a biological clock in their antennae. They may also sense the Earth's magnetic field, which helps them orient themselves even on cloudy days when the sun is hidden.

Sadly, monarch populations have declined dramatically in recent decades. The milkweed plants that monarch caterpillars depend on for food have been disappearing due to agricultural practices and urban development. Illegal logging in their Mexican wintering grounds has also destroyed crucial habitat. Conservation efforts are underway, with communities planting butterfly gardens and protecting forest reserves. The monarch's journey reminds us that the most extraordinary achievements can come from the smallest, most determined travelers.`,
    },
    // ===== HIGH SCHOOL (2 articles) =====
    {
      title: "The Discovery of Penicillin: A Medical Revolution",
      grade_level: "high",
      category: "academic",
      author: "Dr. Sarah Chen, Science Historian",
      background: "## Historical Context\n\nBefore penicillin was discovered in 1928, even minor infections could be fatal. A simple cut from shaving, a scratch from gardening, or a sore throat from streptococcus bacteria could lead to death. Hospitals were filled with patients dying from infections that today we could cure in days.\n\n## About Alexander Fleming\n\nSir Alexander Fleming (1881-1955) was a Scottish physician and microbiologist. He served as a captain in the Royal Army Medical Corps during World War I, where he witnessed countless soldiers dying from infected wounds. This experience inspired his lifelong search for antibacterial substances.",
      source: "Adapted from Nobel Prize archives and scientific biographies",
      content: `The discovery of penicillin stands as perhaps the most serendipitous breakthrough in medical history—a discovery that has saved an estimated 200 million lives since its introduction. The story begins in September 1928, when a somewhat untidy Scottish bacteriologist returned from a two-week family vacation to find something extraordinary growing in his abandoned laboratory.

Alexander Fleming had been researching Staphylococcus aureus, a bacterium responsible for everything from minor skin infections to life-threatening pneumonia. Before leaving for his holiday, he had stacked several petri dishes containing bacterial cultures on a corner of his workbench, intending to discard them upon his return. But when he picked up one dish, he noticed a mold spore had landed on it—and all around that mold, the bacteria had completely disappeared.

Fleming identified the mold as Penicillium notatum, a common fungus found on decaying fruit and bread. What fascinated him was that the mold was secreting a substance capable of destroying some of the most dangerous bacteria known to medicine. He named this substance "penicillin" and published his initial findings in the British Journal of Experimental Pathology in 1929. However, the scientific community showed remarkably little enthusiasm. Extracting and purifying penicillin proved extremely difficult with the equipment available, and Fleming himself lacked the biochemical expertise to isolate the active compound.

The true breakthrough came a decade later, as World War II created an urgent need for effective infection treatment. Howard Florey, an Australian pathologist, and Ernst Chain, a German-born biochemist, assembled a team at Oxford University that successfully purified penicillin and demonstrated its remarkable healing power. Their first patient, a policeman named Albert Alexander, was dying from a severe infection caused by a scratch from a rose thorn. After receiving penicillin, he began to recover dramatically—although tragically, the limited supply ran out before he could be fully cured.

Recognizing the drug's immense potential, Florey traveled to the United States to persuade pharmaceutical companies to mass-produce penicillin. By D-Day in 1944, Allied forces landed in Normandy carrying enough penicillin to treat every wounded soldier. What had once been a laboratory curiosity had become a weapon of war—not for killing, but for saving lives. In 1945, Fleming, Florey, and Chain shared the Nobel Prize in Physiology or Medicine. Fleming used his Nobel lecture to warn about antibiotic resistance, predicting with remarkable foresight that overuse of antibiotics would lead to resistant bacteria—a warning that has proven tragically prophetic in our own time.`,
    },
    {
      title: "Should High School Students Work Part-Time?",
      grade_level: "high",
      category: "argumentative",
      author: "Dr. James Liu, Educational Psychology Review",
      background: "## Topic Background\n\nThe debate over teenage employment has intensified as academic competition increases globally. In China, the Gaokao system creates intense pressure; in the US, college admissions grow ever more selective. Yet employers increasingly value work experience alongside academic credentials.\n\n## Key Statistics\n\n- 35% of US high school students hold part-time jobs\n- Students working 1-15 hours/week show no grade decline vs. non-working peers\n- Students working 16+ hours/week average 0.3 GPA points lower\n- 80% of employers say work experience is as important as grades",
      source: "Adapted from Journal of Educational Psychology and Bureau of Labor Statistics data",
      content: `The question of whether high school students should take part-time employment has divided educators, parents, and policymakers for decades. On one side of the debate, advocates argue that early work experience builds character, teaches financial responsibility, and develops skills that no classroom can impart. On the other side, critics warn that working while studying distracts from academic pursuits, increases stress, and deprives teenagers of the social and developmental experiences crucial to their age. The evidence, as with most complex social questions, supports neither extreme but rather points to a nuanced middle ground.

Those who champion student employment make compelling arguments. A part-time job teaches time management in a way that homework assignments never can—when you must be at work at 4 p.m. sharp or face real consequences, punctuality becomes more than an abstract virtue. Young workers learn to interact with customers, handle difficult situations, and collaborate with colleagues from diverse backgrounds. They develop financial literacy naturally: when you have earned the money yourself through hours of work, you think twice before spending it impulsively. Studies from the University of Michigan's Monitoring the Future project, which has tracked thousands of adolescents since 1976, found that students who worked moderate hours reported higher self-esteem, greater sense of responsibility, and better time management skills than their non-working peers.

However, the research also reveals a clear threshold beyond which employment becomes detrimental. The landmark National Research Council study found that students working more than 20 hours per week experienced significantly lower grades, higher rates of substance use, and decreased engagement with school. The mechanism appears straightforward: when work consumes 15-20 hours per week plus school time, homework, and extracurriculars, something must give, and that something is usually sleep. Chronically sleep-deprived teenagers cannot learn effectively, regardless of how motivated they may be. Furthermore, students who work excessive hours often miss out on sports, clubs, and social activities—the very experiences that build well-rounded individuals and, ironically, the kind of "soft skills" that employers later value.

The solution, according to a growing consensus among researchers, lies in moderation and context. Working 10 to 12 hours per week during the school year appears to provide the benefits of employment without imposing significant academic costs. The type of job matters too: positions that build skills relevant to a student's interests—such as tutoring for aspiring teachers or retail for those interested in business—offer greater long-term value than purely manual labor. Summer employment, which avoids conflict with schoolwork entirely, represents an excellent compromise that allows intensive work experience without academic sacrifice.

Ultimately, the decision should be individualized. A student who struggles academically may need every available hour for study, while a high-achieving student with strong time management skills may thrive with the added responsibility. What the research makes clear, however, is that blanket prohibition of teenage work is no more justified than unrestricted employment. The wisest path lies in the middle.`,
    },
    // ===== CET-4 (2 articles) =====
    {
      title: "The Sharing Economy: Redefining Ownership in the Digital Age",
      grade_level: "cet4",
      category: "news",
      author: "Business Innovation Weekly",
      background: "## About CET-4 Level\n\nCET-4 is China's national College English Test Band 4, typically taken by second-year university students. This article is calibrated to CET-4 reading comprehension difficulty, with controlled academic vocabulary and moderate sentence complexity.\n\n## Topic Context\n\nThe sharing economy has transformed how people access goods and services worldwide. From ride-hailing to apartment rentals, digital platforms have enabled peer-to-peer transactions at an unprecedented scale.",
      source: "Adapted from Harvard Business Review and The Economist, 2025",
      content: `Over the past decade, a quiet revolution has transformed the way millions of people access transportation, accommodation, and everyday goods. This revolution, known as the sharing economy, allows individuals to rent or share assets they own—their cars, their homes, their tools, and even their time—with strangers through digital platforms. Companies like Uber, Airbnb, and Didi Chuxing have become household names, but they represent only the most visible tip of a much larger economic transformation.

The fundamental idea behind the sharing economy is elegantly simple: many assets sit idle for most of their useful lives. The average car is parked 95% of the time. Power drills, lawn mowers, and other household tools are used for mere minutes per year. Vacation homes stand empty for months at a stretch. By connecting owners with people who need temporary access to these assets, sharing platforms unlock value that was previously wasted. This creates a triple benefit: owners earn extra income, users get access at lower cost than traditional alternatives, and society uses resources more efficiently.

However, the rapid growth of sharing platforms has also generated significant controversy. Traditional industries complain that these platforms operate under different rules. Taxi drivers invest in expensive licenses and undergo rigorous safety checks, while ride-share drivers face fewer requirements. Hotels must comply with strict safety, accessibility, and tax regulations that private hosts on rental platforms often bypass. City governments around the world have struggled to adapt regulations designed for a different era to these new business models.

The impact on workers has been equally complex. Proponents celebrate the flexibility that platform work offers: drivers and hosts can set their own hours and be their own bosses. Critics point to the lack of traditional employment protections: no minimum wage guarantees, no health insurance, no paid sick leave, and no job security. Are platform workers entrepreneurs enjoying new freedoms, or are they employees denied the rights they deserve? Courts and legislatures worldwide continue to debate this question.

For consumers, the sharing economy has delivered genuine value. Travelers can find affordable accommodation in neighborhoods far from expensive hotel districts. Commuters can get rides in areas poorly served by public transit. People who cannot afford to buy expensive equipment can rent it when needed. But these benefits come with trade-offs: the quality and safety of services can be inconsistent, and the decline of traditional competitors may reduce options in the long run.

Looking ahead, the sharing economy appears poised to expand into new domains. Peer-to-peer lending platforms allow individuals to borrow and lend money directly. Skill-sharing platforms connect people who want to learn with those willing to teach. Even energy sharing is emerging, with households selling excess solar power to their neighbors. The fundamental question is not whether the sharing economy will continue to grow, but whether societies can develop regulatory frameworks that preserve its benefits while protecting workers, consumers, and communities from its potential harms.`,
    },
    {
      title: "Why Sleep Matters More Than You Think",
      grade_level: "cet4",
      category: "academic",
      author: "Dr. Matthew Chen, Sleep Research Institute",
      background: "## Why This Topic?\n\nCollege students are among the most sleep-deprived populations. Understanding sleep science can help students make better decisions about their study habits and overall health.\n\n## Key Facts\n\n- Humans spend about one-third of their lives sleeping\n- Sleep deprivation impairs cognitive function as much as alcohol intoxication\n- During sleep, the brain clears out toxic waste products that accumulate during waking hours\n- The glymphatic system, discovered in 2012, is the brain's cleaning mechanism that operates primarily during deep sleep",
      source: "Adapted from Nature, Science, and sleep research publications",
      content: `For centuries, sleep was viewed as a passive state—a simple absence of wakefulness during which the brain essentially shut down. This could not be further from the truth. Modern neuroscience has revealed that sleep is an extraordinarily active biological process essential for learning, memory, emotional regulation, immune function, and even the physical cleaning of the brain itself. Yet in our 24/7 society, sleep is often treated as an inconvenience, an obstacle to productivity that ambitious people should try to minimize.

The most immediate consequence of sleep deprivation is cognitive impairment. After staying awake for 17 to 19 hours—a typical day for many students during exam season—cognitive performance drops to the level observed with a blood alcohol concentration of 0.05%. After 20 hours awake, performance matches that of someone legally intoxicated. Memory consolidation, the process by which new information is transferred from short-term to long-term storage, occurs primarily during sleep. Students who sacrifice sleep to study more are, quite literally, studying harder but learning less.

Sleep also plays a critical role in emotional well-being. The amygdala, the brain's emotional center, becomes hyperactive when we are sleep-deprived, producing exaggerated emotional responses to negative stimuli. Meanwhile, the prefrontal cortex, which normally exercises rational control over emotional reactions, shows reduced activity. This explains why minor frustrations feel like catastrophes after a poor night's sleep, and why chronic sleep deprivation is strongly associated with anxiety and depression.

Perhaps the most fascinating recent discovery involves the glymphatic system. In 2012, researchers at the University of Rochester discovered that during deep sleep, the brain's cells actually shrink slightly, increasing the space between them by about 60%. Cerebrospinal fluid then flows through these enlarged spaces, washing away toxic proteins, including beta-amyloid—the protein that accumulates in the brains of Alzheimer's patients. This cleaning system is almost completely inactive during wakefulness. The implications are profound: consistent sleep deprivation may literally allow toxic waste to accumulate in the brain, potentially increasing the risk of neurodegenerative disease decades later.

The question, then, is not whether we can afford to sleep enough, but whether we can afford not to. The evidence is overwhelming that adequate sleep—seven to nine hours for most adults—is not a luxury but a biological necessity. As neuroscientist Matthew Walker puts it, "Sleep is the single most effective thing you can do to reset your brain and body health each day." In a culture that celebrates burning the midnight oil, perhaps the most productive choice we can make is to turn off the lights and go to sleep.`,
    },
    // ===== CET-6 (2 articles) =====
    {
      title: "Artificial Intelligence and the Future of Employment",
      grade_level: "cet6",
      category: "academic",
      author: "Prof. Richard Zhang, Institute for Technology and Society",
      background: "## About CET-6 Level\n\nCET-6 is taken by university students who have passed CET-4, typically in their third or fourth year. This article features more sophisticated vocabulary, complex sentence structures, and abstract concepts appropriate for advanced undergraduates.\n\n## Context\n\nAI is reshaping global labor markets at an accelerating pace. Understanding which jobs are most vulnerable to automation, which new roles will emerge, and how education must adapt is essential for students preparing to enter the workforce.",
      source: "Adapted from World Economic Forum reports and MIT Technology Review, 2025",
      content: `The relationship between technological progress and employment has always been complex and often painful. The Industrial Revolution destroyed the livelihoods of skilled artisans while creating factory jobs that employed millions. The computer revolution eliminated millions of clerical positions while generating entirely new industries in software, e-commerce, and digital services. Today, artificial intelligence promises—or threatens, depending on one's perspective—to automate cognitive tasks once thought to be uniquely human. The critical question is not whether AI will transform employment, but how societies can manage that transformation to produce broadly shared prosperity rather than mass displacement.

The capabilities of modern AI systems have expanded dramatically beyond what experts predicted even a decade ago. Large language models can now write competent essays, generate computer code, analyze legal documents, and compose marketing copy. Image generation systems produce professional-quality illustrations from text descriptions. AI diagnostic tools match or exceed the accuracy of experienced radiologists in detecting certain cancers. These are not speculative future capabilities; they are commercially available products deployed in workplaces today.

However, the popular narrative of AI making all human workers obsolete is deeply misleading. AI systems excel at tasks with clear patterns, large training datasets, and well-defined success metrics. They struggle with tasks requiring genuine creativity, complex social interaction, ethical judgment, and the integration of knowledge across widely different domains—precisely the capabilities that define expert human performance in many fields. A study published in Science examined over 1,000 occupations and concluded that while almost every job contains some tasks that could be automated, fewer than 5% of occupations could be fully automated with current technology. For the vast majority of workers, AI will change what they do rather than eliminate their jobs entirely.

The more realistic challenge is one of adaptation. The skills that employers value are shifting toward those that complement AI rather than compete with it: critical thinking, creativity, emotional intelligence, complex problem-solving, and the ability to learn continuously. Educational systems designed for an industrial era—standardized curricula, fixed timelines, emphasis on memorization—are poorly suited to developing these capabilities. Countries that invest in retraining programs, reform their education systems, and strengthen social safety nets will be far better positioned than those that simply hope technology will not disrupt their labor markets.

There are reasons for cautious optimism. Historical evidence consistently shows that technological progress creates more jobs than it destroys, though the transition can be devastating for individuals caught in the middle. The World Economic Forum estimates that AI will displace 85 million jobs by 2030 while creating 97 million new ones—a net gain of 12 million positions. But these new roles will require different skills, often in different locations, and the workers who lose their jobs may not be the same people who fill the new ones. The policy challenge is to ensure that the benefits of AI-driven productivity gains are shared broadly rather than concentrated among the owners of capital and a small elite of highly skilled knowledge workers. Societies that succeed in this challenge will find AI to be a powerful engine of prosperity; those that fail may face deepening inequality and social instability.`,
    },
    {
      title: "The Psychology of Habit Formation",
      grade_level: "cet6",
      category: "academic",
      author: "Dr. Emily Wang, Behavioral Science Department",
      background: "## About This Topic\n\nUnderstanding how habits form and how they can be changed is one of the most practically useful areas of psychology. This knowledge is directly applicable to language learning, where consistent daily practice is far more effective than occasional intensive study.\n\n## Key Concepts\n\n- **Habit loop**: Cue → Routine → Reward (Charles Duhigg's framework)\n- **Implementation intentions**: If-then plans that specify when, where, and how you will perform a behavior\n- **Friction**: Anything that makes a behavior harder to perform—reducing friction for good habits and increasing it for bad ones is a powerful strategy",
      source: "Adapted from academic research in behavioral psychology",
      content: `We are what we repeatedly do. This insight, articulated by Aristotle more than two millennia ago, has been validated by modern neuroscience and behavioral psychology. Research consistently shows that approximately 40 to 45 percent of our daily behaviors are not conscious decisions but automatic habits—patterns so deeply ingrained that we perform them with little or no deliberate thought. Understanding the mechanisms by which habits form, persist, and can be modified is therefore one of the most powerful tools available for personal development, and it holds particular relevance for anyone attempting to master a complex skill like a foreign language.

The neuroscientific basis of habit formation lies in a process called "chunking," by which the brain converts a sequence of actions into an automatic routine. When you first perform a new behavior—driving a car, playing a musical scale, pronouncing an unfamiliar English word—the prefrontal cortex works intensely, consuming significant mental energy. But with repetition, control of the behavior gradually shifts to the basal ganglia, a more primitive brain region associated with automatic processes. This shift is adaptive: it frees up the prefrontal cortex for higher-level thinking. The downside is that once a behavior becomes habitual, it can be extraordinarily difficult to change through conscious effort alone.

Contrary to popular belief, there is no magic number of days required to form a habit. The widely cited "21-day rule" originated from a plastic surgeon's anecdotal observation about how long it took patients to adjust to their new faces after surgery—it has no basis in rigorous research. A landmark study published in the European Journal of Social Psychology found that habit formation took anywhere from 18 to 254 days, with a median of 66 days. The key variables were the complexity of the behavior and the consistency of performance. Simple behaviors like drinking a glass of water after breakfast formed quickly; complex behaviors like doing 50 sit-ups took much longer.

This finding has profound implications for language learning. Many students attempt to cram hours of study into occasional weekend sessions while neglecting daily practice. The neuroscience of habit formation suggests the opposite approach is far more effective: study for shorter periods but do so every single day. Twenty minutes of English practice daily will, over time, produce better results than four hours every Sunday, because the daily practice builds the automatic neural pathways that underpin fluent language use. The habit becomes self-reinforcing: the more consistently you practice, the more automatic the behavior becomes, and the less willpower is required to maintain it.

Implementation intentions are a specific, evidence-based strategy for habit formation. Rather than setting vague goals like "I will study more English," you create specific if-then plans: "When I finish breakfast, I will read one English article for 20 minutes at my desk." Research by psychologist Peter Gollwitzer has demonstrated that people who form implementation intentions are two to three times more likely to achieve their behavioral goals compared to those with strong motivation but no specific plan. The specificity removes the need for decision-making in the moment—the habit trigger automatically activates the intended behavior.

The practical lesson for anyone building an English learning habit is straightforward: pick a specific daily trigger, start with a manageable commitment, maintain absolute consistency for at least two months, and trust the process. The brain is not a muscle, but it responds to training in remarkably similar ways. Every repetition strengthens the neural pathway; every skipped day weakens it. As the neuroscientist Donald Hebb famously summarized the principle, "Neurons that fire together, wire together." Your daily English practice is, quite literally, rewiring your brain.`,
    },
    // ===== TEM-4 (2 articles) =====
    {
      title: "Cultural Intelligence in Global Business Communication",
      grade_level: "tem4",
      category: "academic",
      author: "Dr. Lisa Thompson, International Business School",
      background: "## About TEM-4 Level\n\nTEM-4 (Test for English Majors Band 4) is taken by second-year English majors in Chinese universities. This article features advanced vocabulary, complex grammatical structures, and nuanced argumentation appropriate for English majors.\n\n## Key Concepts\n\n- **Cultural intelligence (CQ)**: The capability to function effectively across national, ethnic, and organizational cultures\n- **High-context vs. low-context communication**: The extent to which meaning depends on explicit verbal content versus shared cultural understanding\n- **Ethnocentrism**: Evaluating other cultures according to the standards of one's own culture",
      source: "Adapted from Harvard Business Review and Journal of International Business Studies",
      content: `In an increasingly interconnected global economy, the ability to communicate effectively across cultural boundaries has become as essential as technical competence. Yet organizations continue to underestimate the complexity of cross-cultural business communication, treating it as a matter of simple translation rather than a fundamental challenge of meaning-making across different cognitive and social frameworks. The concept of cultural intelligence, or CQ, has emerged as a crucial framework for understanding why some individuals and organizations thrive in multicultural environments while others flounder despite equal technical qualifications.

The foundational insight of cross-cultural communication research is that meaning is not transmitted but constructed. When a Japanese manager says "that might be difficult" in response to a proposal, an American counterpart might hear a problem to be solved, while a Japanese colleague would recognize a polite refusal. When a German engineer provides a detailed critique of a design, a British partner might perceive hostility, while the German intends respect through rigorous analysis. These misunderstandings arise not from language barriers alone but from fundamentally different assumptions about how communication itself should work.

Edward T. Hall's distinction between high-context and low-context cultures provides one of the most useful frameworks for understanding these differences. In low-context cultures—exemplified by Germany, Scandinavia, and the United States—communication is expected to be explicit, direct, and complete in itself. The message should contain all necessary information; the listener should not need to read between the lines. In high-context cultures—including Japan, China, and many Arab nations—much of the meaning is carried by the context: the relationship between speakers, the setting, shared cultural knowledge, and nonverbal cues. A direct "no" in such cultures may be considered rude not because of the refusal itself but because making it explicit violates the relationship.

The implications for business are far-reaching. Negotiation strategies that work brilliantly in one cultural context can backfire spectacularly in another. Leadership styles that inspire employees in Sweden—participative, consensus-oriented—may be perceived as weak and indecisive in cultures that expect leaders to project authority. Performance feedback that American employees consider constructive may devastate employees from cultures where direct criticism, especially in front of others, causes profound loss of face.

Developing cultural intelligence requires more than memorizing lists of dos and don'ts for specific cultures—an approach that quickly becomes outdated and reinforces stereotypes. True CQ involves a more fundamental capacity: the ability to recognize when cultural differences are at play, to temporarily suspend judgment based on one's own cultural programming, and to adapt behavior flexibly to the cultural context. This is a skill that, like any other, can be learned and improved with deliberate practice, exposure to diverse cultural environments, and genuine curiosity about how other people make sense of the world. In a global economy where the only constant is the increasing diversity of the workforce and customer base, cultural intelligence is no longer a supplementary skill but a core professional competence.`,
    },
    {
      title: "The Digital Humanities: When Literature Meets Data Science",
      grade_level: "tem4",
      category: "academic",
      author: "Prof. Anna Kowalski, Digital Humanities Research Center",
      background: "## About This Field\n\nDigital humanities applies computational methods to traditional humanities questions. It represents a bridge between two academic cultures that have historically had little interaction: the interpretative, qualitative tradition of literary studies and the quantitative, data-driven methods of computer science.\n\n## Methods Discussed\n\n- **Text mining**: Extracting patterns and information from large collections of text\n- **Stylometry**: Quantitative analysis of literary style, often used for authorship attribution\n- **Topic modeling**: Algorithmically identifying themes that recur across a corpus of texts",
      source: "Adapted from Nature and Digital Scholarship in the Humanities",
      content: `For centuries, the study of literature proceeded through the close, careful reading of individual texts. A scholar might spend years analyzing the complete works of a single author, developing deep expertise through intimate familiarity with a relatively small corpus. This approach—close reading—produced profound insights, but it also had inherent limitations. A human being can only read so many books in a lifetime, and patterns that span hundreds or thousands of texts remain invisible to even the most dedicated scholar working alone with traditional methods.

The emergence of digital humanities over the past two decades has introduced an entirely different approach. By digitizing vast collections of texts and applying computational analysis, scholars can now examine literary patterns at a scale that was previously unimaginable. This technique, often called "distant reading" following the literary scholar Franco Moretti, treats thousands of books as data points from which macro-level patterns can be extracted. Rather than asking what makes a single novel distinctive, distant reading asks what broad patterns characterize entire genres, periods, or national literatures.

The methodological tensions between traditional and digital approaches are real and productive. Traditional humanists worry, not unreasonably, that reducing literature to data strips it of the very qualities that make it worth studying: ambiguity, aesthetic complexity, and the irreducible particularity of great works. A computer can count how many times the word "love" appears in a novel, but can it understand love? Digital humanists respond that they are not replacing close reading but supplementing it. Computational methods reveal patterns that close readers can then investigate in greater depth; the two approaches are complementary rather than competing.

The most significant contributions of digital humanities to date have been in areas where scale genuinely matters. Stylometry, the quantitative analysis of literary style, has resolved long-standing authorship disputes. When scholars suspected that an anonymous 16th-century Spanish play was actually an early work by Cervantes, computational analysis of word frequencies, sentence lengths, and syntactic patterns provided strong evidence confirming the attribution. Topic modeling has mapped how certain themes—empire, gender, industrialization—rose and fell across thousands of 19th-century British novels, revealing cultural trends invisible through traditional reading alone.

Perhaps the most exciting frontier in digital humanities involves the study of literary influence and intertextuality on a massive scale. By computationally comparing the texts of millions of books, researchers can trace how specific phrases, ideas, or stylistic innovations spread through a literary culture over decades or centuries. A study published in Science examined the linguistic patterns of over 5 million digitized books in multiple languages, constructing a quantitative history of cultural evolution through the words people wrote and read.

The digital humanities do not promise to make traditional literary scholarship obsolete, any more than the telescope made naked-eye astronomy obsolete. What they offer is a new instrument, one that reveals patterns at a scale previously hidden from view. The challenge for the next generation of humanities scholars is to become literate in both the interpretive traditions of their disciplines and the computational methods that will increasingly define the frontiers of knowledge across all fields of inquiry.`,
    },
    // ===== TEM-8 (2 articles) =====
    {
      title: "Postmodernism and the Crisis of Narrative in Contemporary Fiction",
      grade_level: "tem8",
      category: "academic",
      author: "Dr. Jonathan Swift, Comparative Literature Department",
      background: "## About TEM-8 Level\n\nTEM-8 is the highest level of China's Test for English Majors, taken by fourth-year English majors. Articles at this level feature sophisticated academic vocabulary, complex argumentation, literary and philosophical references, and nuanced rhetorical strategies.\n\n## Key Terms\n\n- **Metanarrative**: An overarching story or theory that claims to explain large-scale historical or social phenomena\n- **Deconstruction**: A philosophical approach that analyzes texts to reveal hidden assumptions and contradictions\n- **Intertextuality**: The relationship between texts, especially the ways texts reference, absorb, and transform other texts",
      source: "Adapted from academic literary criticism and critical theory journals",
      content: `The latter half of the twentieth century witnessed a profound transformation in the way writers, critics, and philosophers understood the act of storytelling. The grand narrative traditions that had dominated Western literature since the nineteenth century—the omniscient narrator, the coherent psychological subject, the linear progression from conflict to resolution—came under sustained attack from a diverse array of thinkers associated, sometimes loosely, with what came to be called postmodernism. This intellectual movement, if it can properly be called a movement at all given its resistance to unified definitions, fundamentally challenged the epistemological foundations upon which traditional narrative rests.

Jean-François Lyotard's influential formulation defined the postmodern condition as "incredulity toward metanarratives"—a skepticism toward the grand explanatory stories that modernity had used to make sense of history: the Enlightenment narrative of inevitable progress, the Marxist narrative of class struggle leading to utopia, the capitalist narrative of markets producing optimal outcomes. In literature, this skepticism manifested as a deep suspicion of narrative closure, of the idea that stories should resolve themselves neatly, offering moral clarity and psychological coherence. Instead, postmodern fiction embraced fragmentation, paradox, and ontological uncertainty.

The narrative techniques that emerged from this intellectual ferment are now familiar to any student of contemporary literature. Authors like Italo Calvino, Jorge Luis Borges, and Vladimir Nabokov constructed stories that drew attention to their own artificiality, breaking the "fourth wall" to remind readers that they were reading a constructed artifact rather than a transparent window onto reality. Multiple, contradictory narrators replaced the single authoritative voice. Endings refused closure, instead offering ambiguity or self-contradiction. The very notion of a stable, consistent self—the psychological foundation upon which the traditional novel rests—was questioned and frequently dissolved.

Critics of postmodernism have argued, with considerable justification, that its emphasis on linguistic play and epistemological uncertainty can slide into a politically disabling relativism. If all truths are constructed and all narratives are equally suspect, on what basis can one oppose injustice or assert the reality of historical suffering? The philosopher Jürgen Habermas, in his famous debate with Lyotard, argued that the Enlightenment project of reason and emancipation remains incomplete rather than failed, and that abandoning it entirely risks leaving the field to the very forces of domination that critical theory claims to oppose. This debate remains unresolved and perhaps unresolvable, which may itself be taken as evidence for the postmodern position.

Contemporary fiction has, in many respects, moved beyond the high postmodernism of the 1970s and 1980s. Writers like David Foster Wallace, Zadie Smith, and Chimamanda Ngozi Adichie have sought to reclaim the emotional and moral seriousness that postmodern irony seemed to foreclose, while incorporating the formal innovations that postmodernism made available. Wallace described this as a turn toward "sincerity" and "single-entendre principles"—an attempt to use sophisticated narrative techniques not to deconstruct meaning but to construct it more honestly, acknowledging complexity without surrendering to nihilism. Whether this represents a genuine new literary paradigm or merely a refinement of postmodern strategies remains a subject of vigorous critical debate.

What seems clear is that the postmodern critique of narrative has permanently changed the landscape of literary possibility. Even the most traditionally structured contemporary novels operate with an awareness that their narrative conventions are choices rather than natural forms—that every story is told from a particular perspective, governed by particular assumptions, and could have been told differently. This awareness does not, as some feared, make storytelling impossible; it makes it more self-conscious, and arguably more honest. The challenge for contemporary writers is to harness this sophistication in the service of genuine emotional and intellectual engagement, rather than allowing it to become a prison of ironic detachment.`,
    },
    {
      title: "The Neuroscience of Consciousness: Hard Problems and Emerging Paradigms",
      grade_level: "tem8",
      category: "academic",
      author: "Prof. Maria Gonzalez, Center for Consciousness Studies",
      background: `## About This Topic\n\nThe nature of consciousness has been called the "hard problem" of neuroscience—the question of how subjective experience arises from physical brain processes. This article introduces key theories and debates at a level appropriate for advanced English majors with strong academic reading skills.\n\n## Key Theories\n\n- **Integrated Information Theory (IIT)**: Proposes that consciousness is identical to the amount of integrated information a system generates\n- **Global Workspace Theory (GWT)**: Suggests consciousness arises when information is broadcast to a "global workspace" in the brain\n- **Predictive Processing**: Frames consciousness as emerging from the brain's continuous generation and updating of predictions about sensory input`,
      source: "Adapted from Nature Neuroscience, Trends in Cognitive Sciences, and philosophical journals",
      content: `What is it like to be a bat? This deceptively simple question, posed by philosopher Thomas Nagel in his landmark 1974 paper, crystallizes the central mystery of consciousness research. There is something it is like to be a bat—there is a subjective, first-person experience of echolocation, of flight, of hanging upside down in a cave. But how does this subjective experience arise from the physical firing of neurons in a bat's brain? And why should neural activity be accompanied by experience at all? This is what philosopher David Chalmers famously termed the "hard problem" of consciousness, distinguishing it from the "easy problems" of explaining specific cognitive functions like perception, memory, and attention—problems that are merely incredibly difficult rather than fundamentally mysterious.

The dominant framework in consciousness science has been the search for neural correlates of consciousness—the minimal set of neuronal events sufficient for a specific conscious percept. Researchers can present a stimulus at the threshold of conscious perception and compare brain activity when subjects report seeing it versus when they do not. These experiments have identified characteristic signatures of conscious processing: widespread activation across cortical regions, sustained rather than transient neural firing, and synchronization of activity across distant brain areas. But correlation is not explanation. Identifying the neural activity that accompanies conscious experience does not explain why that activity is accompanied by experience rather than occurring in the dark, as it were, with no inner life whatever.

Several ambitious theories have attempted to bridge this explanatory gap, each with its own strengths and limitations. Integrated Information Theory, developed by neuroscientist Giulio Tononi, proposes a mathematical framework in which consciousness is a fundamental property of any system that integrates information in a particular way. The theory makes the startling prediction that consciousness is not binary but graded—that any system with sufficient integrated information possesses some degree of consciousness, including potentially some non-biological systems. Critics have noted that the theory's central measure, denoted by the Greek letter Φ, is computationally intractable for any system larger than a few neurons, and that the theory struggles to explain why specific neural structures seem more closely associated with consciousness than others.

The Global Workspace Theory, proposed by Bernard Baars and developed by Stanislas Dehaene, takes a more neurobiologically grounded approach. It posits that conscious access occurs when information from specialized, unconscious processors is selected and amplified into a global workspace where it becomes available to multiple cognitive systems including memory, attention, and verbal report. This theory has generated substantial empirical support from neuroimaging studies showing that consciously perceived stimuli trigger a characteristic "ignition" of activity across prefrontal and parietal regions. However, the theory primarily addresses access consciousness—the ability to report and use information—rather than phenomenal consciousness, the raw felt quality of experience.

The predictive processing framework, which has gained considerable traction in recent years, reframes consciousness within a broader theory of brain function as hierarchical prediction. The brain, on this view, is not a passive receiver of sensory information but an active hypothesis-testing system that continuously generates predictions about incoming sensory signals and updates its internal models based on prediction errors. Consciousness, in this framework, might correspond to the highest-level predictions in this hierarchy—the brain's best guess about the causes of its sensory input, which it experiences as the perceived world. This elegantly explains many perceptual phenomena but, like its competitors, struggles to close the gap between information processing and subjective experience.

Whether the hard problem will eventually yield to scientific investigation or represents a fundamental limit to what objective methods can explain remains deeply uncertain. Some philosophers and neuroscientists, following Daniel Dennett, argue that the hard problem is an illusion—that once we have explained all the cognitive functions associated with consciousness, there is nothing left to explain. Others, like Chalmers, maintain that consciousness may be as fundamental to the universe as space, time, and matter, requiring an expansion of our scientific ontology. What is certain is that consciousness research has moved from the margins of respectable science to one of its most dynamic frontiers, drawing together neuroscientists, philosophers, physicists, and computer scientists in pursuit of what may be the ultimate scientific question: how matter becomes mind.`,
    },
    // ===== IELTS (2 articles) =====
    {
      title: "Urbanization and Environmental Sustainability in the 21st Century",
      grade_level: "ielts",
      category: "news",
      author: "Global Development Research Center",
      background: "## About IELTS Level\n\nThis article is calibrated to IELTS Academic Reading Band 7.0-8.0, featuring the academic vocabulary, data interpretation, and argument-following skills tested in the IELTS examination.\n\n## Key Data Points\n\n- 56% of the world's population now lives in cities (UN, 2024)\n- Cities consume 78% of the world's energy and produce 70% of carbon emissions\n- Urban green space has declined 40% in rapidly developing Asian and African cities over 30 years\n- Well-designed compact cities can reduce per capita emissions by 30-50% compared to low-density sprawl",
      source: "Adapted from United Nations Habitat reports and academic journals",
      content: `The twenty-first century has been characterized as the "urban century" with good reason. In 2007, for the first time in human history, more people lived in cities than in rural areas. By 2024, the urban proportion had reached 56%, and United Nations projections indicate it will surpass 68% by 2050. This represents the largest and most rapid demographic transition our species has ever undertaken—a migration of billions from agricultural lives to urban ones, concentrated overwhelmingly in Asia and Africa. The implications for environmental sustainability, public health, and social equity are so profound that they can scarcely be overstated.

Urbanization presents what economists call a fundamental externality problem. Cities concentrate economic activity, which drives productivity and innovation; the ten largest metropolitan economies in the world each produce more GDP than many medium-sized countries. But cities also concentrate environmental impacts. Although urban areas cover only about 2% of the Earth's land surface, they consume approximately 78% of global energy and produce more than 70% of carbon dioxide emissions. The question is whether urbanization is inherently environmentally destructive, or whether the problem lies in how we build and manage cities rather than in urban density itself.

The evidence increasingly points toward the latter conclusion. Compact, well-designed cities can be remarkably resource-efficient. When people live at higher densities, the per-capita cost of providing infrastructure—roads, water systems, public transit, electricity grids—declines substantially. Public transportation becomes economically viable at densities where it would be impossible in low-density suburbs. District heating systems, which capture waste heat from power generation and industrial processes to warm residential buildings, achieve efficiencies that individual furnaces cannot match. Studies comparing cities with similar income levels but different urban forms have found that compact cities produce 30 to 50 percent less greenhouse gas per capita than their sprawling counterparts.

The destruction of urban green space represents one of the most visible and ecologically consequential aspects of poorly managed urbanization. In rapidly expanding cities across Asia and Africa, green cover has diminished by approximately 40% over three decades. This loss is not merely aesthetic. Urban vegetation provides critical ecosystem services: trees filter air pollutants, absorb stormwater runoff that would otherwise cause flooding, mitigate the urban heat island effect that can make cities several degrees warmer than surrounding rural areas, and provide habitat for urban wildlife. The mental health benefits of access to green space have been demonstrated in dozens of studies showing reduced rates of depression, anxiety, and stress-related illness among urban residents with regular exposure to nature.

The challenge of sustainable urbanization is fundamentally a challenge of governance and political will rather than technology or resources. The technical solutions are well understood: invest in mass transit rather than highways, mandate energy-efficient building codes, protect and expand urban green space, implement congestion pricing to reduce traffic, design neighborhoods where daily needs can be met on foot or by bicycle. Cities that have implemented these measures—Copenhagen, Singapore, Curitiba, Freiburg—have demonstrated that it is possible to achieve high quality of life with significantly lower environmental impact. The obstacle is not that we do not know what to do, but that powerful interests benefit from the status quo, and the costs of unsustainable development are distributed across the entire population while the benefits accrue to a concentrated few.

The scale and speed of ongoing urbanization make this arguably the most consequential environmental governance challenge of the coming decades. Decisions about urban form—about density, transportation, energy systems, green space—made today will lock in patterns of resource consumption and environmental impact for generations. Every city that expands through low-density sprawl rather than compact, transit-oriented development commits its future residents to higher energy costs, longer commutes, and greater environmental damage. Getting urbanization right is not one environmental priority among many; it is, to a significant extent, the condition for getting everything else right.`,
    },
    {
      title: "The Economics of Healthcare: Market Failures and Policy Solutions",
      grade_level: "ielts",
      category: "argumentative",
      author: "Dr. Sarah Mitchell, Health Policy Institute",
      background: "## About This Topic\n\nHealthcare economics is a common IELTS Reading topic that tests the ability to understand complex arguments involving data, causation, and policy trade-offs. This article presents competing perspectives on a central policy question.\n\n## Key Economic Concepts\n\n- **Adverse selection**: When those most likely to need insurance are most likely to buy it, driving up costs\n- **Moral hazard**: When insurance reduces the incentive to avoid risky behavior or consume healthcare efficiently\n- **Information asymmetry**: When one party (the healthcare provider) has significantly more information than the other (the patient)",
      source: "Adapted from The Lancet, Health Affairs, and WHO policy reports",
      content: `Healthcare occupies a unique and uncomfortable position in economic theory. It is simultaneously a service that people consume, an investment in human capital, and—in most societies—a right whose distribution according to ability to pay strikes many as morally unacceptable. Standard market mechanisms, which work reasonably well for allocating smartphones or restaurant meals, function poorly or not at all when applied to heart surgery or cancer treatment. Understanding why healthcare markets fail so systematically, and what policy interventions might address those failures, is essential for informed citizenship in any modern democracy.

The first fundamental problem is information asymmetry. When you buy a smartphone, you can read reviews, compare specifications, and evaluate whether the product meets your needs. When a doctor recommends a course of treatment, you typically lack the specialized knowledge to evaluate whether that recommendation is appropriate, necessary, or cost-effective. You must trust the provider—but the provider also has financial incentives that may not align perfectly with your best interests. In fee-for-service systems, providers earn more by doing more, creating an incentive for overtreatment. This is not a matter of dishonest individuals but of systemic incentives that would influence anyone's behavior.

The second fundamental problem concerns insurance markets specifically. Health insurance should, in theory, work like any other insurance: pool risks across a large population so that the fortunate many subsidize the unfortunate few. But health insurance markets are plagued by what economists call adverse selection. Healthy people, especially young healthy people, are often reluctant to purchase insurance they do not expect to need. Sick people, understandably, are eager to buy it. If insurers cannot effectively discriminate based on health status—which most societies consider morally unacceptable—the insurance pool becomes increasingly sick and expensive, premiums rise, more healthy people drop out, and the market enters what is known as a "death spiral." This is not a theoretical concern; it has been observed in real insurance markets repeatedly.

The third problem is that healthcare involves what economists call inelastic demand. If the price of smartphones doubles, many people will delay upgrading. If the price of life-saving insulin doubles, people will still do whatever it takes to obtain it—skip meals, drain savings, go into debt. This means that healthcare markets, left to themselves, can generate extraordinary profits not through superior efficiency but through the exploitation of desperate need. Pharmaceutical companies do not charge high prices for cancer drugs because they are greedy in any simple sense; they charge high prices because the patent system grants them temporary monopolies, and the alternative to paying is unacceptable to patients and their families.

Different countries have adopted radically different approaches to these market failures, and the results are instructive. The United States relies heavily on market mechanisms with government programs for the elderly and poor, resulting in the world's highest per-capita healthcare spending by a wide margin—more than double the OECD average—with health outcomes that rank near the bottom among wealthy nations on many measures. The United Kingdom's National Health Service provides care free at the point of use, funded by general taxation, achieving universal coverage at roughly half the per-capita cost of the American system. Singapore combines mandatory health savings accounts with government subsidies and price controls, achieving excellent outcomes at moderate cost. No system is perfect, but the evidence strongly suggests that purely market-based approaches to healthcare are among the least efficient.

The policy implications are clear even if the politics are difficult. Healthcare requires substantial government intervention to function efficiently and equitably. The specific form of that intervention—single-payer insurance, regulated private insurance with mandates, national health service, or some hybrid—matters less than the principles: universal coverage to eliminate adverse selection, price regulation or reference pricing to address monopoly power, investment in preventive care that markets undervalue because benefits accrue over decades, and transparency requirements to reduce information asymmetry. The question facing every society is not whether to intervene in healthcare markets, but how intelligently.`,
    },
    // ===== TOEFL (2 articles) =====
    {
      title: "Quantum Computing: Principles, Promise, and Practical Limitations",
      grade_level: "toefl",
      category: "academic",
      author: "Dr. Alan Foster, Institute for Advanced Computing",
      background: "## About TOEFL Level\n\nTOEFL iBT reading passages are drawn from university-level textbooks across academic disciplines. This article is calibrated to the high-intermediate to advanced level (approximately 22-30 on the Reading section) and features the academic vocabulary, conceptual density, and disciplinary conventions typical of introductory university science texts.\n\n## Prerequisite Concepts\n\n- **Superposition**: A quantum system can exist in multiple states simultaneously until measured\n- **Entanglement**: Quantum particles can become correlated such that measuring one instantly determines the state of another, regardless of distance\n- **Classical computing**: The computing paradigm based on bits that are either 0 or 1",
      source: "Adapted from Nature, Science, and introductory computer science textbooks",
      content: `The classical computers that power our digital world operate on principles that are elegantly simple. Information is encoded in bits, each of which is definitively either a 0 or a 1. Computation proceeds by manipulating these bits through logical operations, following deterministic rules that guarantee the same input always produces the same output. This model has been so spectacularly successful that it is easy to forget it rests on a particular physical substrate—the classical physics of macroscopic objects. At the quantum scale, reality behaves differently, and those differences open up computational possibilities that have no classical analogue.

The fundamental unit of quantum computing is the qubit, which exploits the quantum mechanical property of superposition. Where a classical bit must be either 0 or 1, a qubit can exist in a superposition of both states simultaneously—not merely unknown to the observer, but genuinely indeterminate until measured. A single qubit represents a modest advantage, but the power scales exponentially: two qubits can represent four states simultaneously, three qubits can represent eight, and n qubits can represent 2^n states. A quantum computer with just 300 qubits could, in principle, represent more states than there are atoms in the observable universe.

This exponential scaling is not merely a theoretical curiosity; it has direct implications for computational complexity. Certain problems that would require classical computers longer than the age of the universe to solve become tractable on a quantum computer. The most famous example is Shor's algorithm, which efficiently factors large numbers into their prime components. This might sound like a niche mathematical concern, but the security of nearly all modern encryption—the RSA protocol that protects online banking, secure messaging, and digital signatures—depends on the practical impossibility of factoring large numbers on classical computers. A sufficiently powerful quantum computer running Shor's algorithm would render current public-key cryptography obsolete.

However, the gap between theoretical possibility and practical implementation is vast. Building a useful quantum computer requires maintaining quantum coherence—the delicate superposition state—across many qubits for long enough to complete a computation. Quantum systems are extraordinarily sensitive to environmental interference; any interaction with the outside world, a phenomenon known as decoherence, collapses the superposition and destroys the quantum advantage. Current quantum processors must be cooled to temperatures colder than interstellar space and isolated from virtually all external electromagnetic radiation. Even so, error rates remain orders of magnitude too high for most practical applications without elaborate error-correction schemes that require many physical qubits for each logical qubit.

The timeline for practical quantum computing remains deeply uncertain. In 2019, Google claimed to have achieved "quantum supremacy"—performing a specific calculation on a 53-qubit processor that would have taken the world's most powerful classical supercomputer thousands of years. IBM promptly disputed the claim, arguing that the classical computation could be performed in a few days with a more clever algorithm. More importantly, the calculation Google performed had no practical value; it was designed specifically to be easy for a quantum computer and hard for a classical one. The transition from such carefully constructed demonstrations to commercially useful quantum computing will require overcoming challenges in qubit stability, error correction, and algorithm design that are far from solved.

The prudent perspective acknowledges both the revolutionary potential of quantum computing and the likelihood that its practical impact will unfold over decades rather than years. Near-term applications in quantum simulation—modeling molecular interactions for drug discovery or materials science—appear more promising than the long-term goal of breaking encryption. And even when large-scale, error-corrected quantum computers become available, they will not replace classical computers but supplement them, handling the specific tasks for which quantum algorithms provide exponential speedup while classical processors continue to dominate everything else. The quantum future is coming, but it will arrive gradually and unevenly, not in a single transformative moment.`,
    },
    {
      title: "Behavioral Economics and the Architecture of Choice",
      grade_level: "toefl",
      category: "academic",
      author: "Prof. Daniel Chen, Department of Economics and Psychology",
      background: "## About This Topic\n\nBehavioral economics integrates insights from psychology into economic theory, challenging the traditional assumption that humans are perfectly rational decision-makers. This topic is common in TOEFL reading passages because it requires understanding conceptual contrasts and evaluating evidence for competing claims.\n\n## Key Concepts\n\n- **Nudge**: An intervention that steers people in a particular direction while preserving their freedom of choice\n- **Loss aversion**: The tendency to prefer avoiding losses over acquiring equivalent gains\n- **Present bias**: The tendency to disproportionately value immediate rewards over future ones\n- **Default effect**: The tendency for people to stick with pre-selected options rather than actively choosing",
      source: "Adapted from academic publications and policy papers",
      content: `For much of the twentieth century, the dominant model of human decision-making in economics was built on a strikingly simple premise: that people are rational actors who process all available information, calculate probabilities accurately, and consistently make choices that maximize their expected utility. This model, known as homo economicus, was never intended as a literal description of human psychology. It was a simplifying assumption that made mathematical modeling tractable. The problem, as a growing body of empirical research demonstrated from the 1970s onward, is that actual human beings deviate from this rational ideal in ways that are systematic, predictable, and economically significant.

The foundational insight of behavioral economics, established by Daniel Kahneman and Amos Tversky through a series of ingenious experiments, is that human judgment is shaped by cognitive heuristics—mental shortcuts that are generally useful but produce systematic biases in specific contexts. We are, for example, far more sensitive to losses than to equivalent gains, a phenomenon known as loss aversion. We discount the future at wildly inconsistent rates, making decisions today that our future selves will regret. We are strongly influenced by how choices are framed: a surgery described as having a "90% survival rate" feels very different from one with a "10% mortality rate," even though the information is mathematically identical. These are not random errors but predictable features of human cognition, shaped by evolutionary pressures that optimized for survival and reproduction in environments very different from modern financial markets and healthcare systems.

The policy implications of behavioral economics are far-reaching and controversial. If people predictably make choices that harm their own interests—failing to save for retirement, eating food that damages their health, neglecting to take prescribed medications—is it legitimate for governments and institutions to intervene? Richard Thaler and Cass Sunstein's concept of "libertarian paternalism" proposes a middle ground: design choice architectures that nudge people toward better decisions while preserving their freedom to choose otherwise. Automatically enrolling employees in retirement savings plans, while allowing them to opt out, dramatically increases participation rates without restricting anyone's freedom. Placing healthier foods at eye level in cafeterias increases their selection without banning anything. These interventions work precisely because they harness our cognitive biases for beneficial ends rather than fighting against them.

Critics raise legitimate concerns about the nudge agenda. Who decides what constitutes a "better" choice? The line between a helpful nudge and manipulative propaganda can be thin. When governments design choice architectures that steer citizens toward particular decisions, they are exercising power, however subtly. There is also the concern that focusing on individual behavior change—nudging people to eat better, exercise more, and save more—distracts from the structural factors that often constrain individual choice more powerfully than any cognitive bias. A person who cannot afford healthy food is not suffering primarily from a decision-making problem, and nudging them toward better choices without addressing the underlying economic constraints may be an exercise in blaming the victim.

The most sophisticated applications of behavioral economics integrate its insights with an understanding of structural inequality and institutional design. Behavioral insights can improve the design of social programs, making it easier for eligible people to access benefits they are entitled to. They can inform financial regulation, protecting consumers from products designed to exploit their cognitive biases. They can make public health communications more effective by accounting for how people actually process risk information rather than how economists wish they would. The goal is not to replace structural solutions with behavioral tweaks, but to ensure that policies at every level are informed by an accurate understanding of human psychology.

What behavioral economics ultimately teaches is humility. The rational actor model is elegant, mathematically tractable, and wrong in ways that matter for policy. Real people are complex, inconsistent, and influenced by factors they often do not consciously recognize. Designing institutions—from retirement systems to healthcare markets to educational programs—that work for real humans rather than idealized rational agents is one of the central challenges of contemporary governance. The first step is to acknowledge that the choice architect cannot be neutral. Every way of presenting options influences what people choose. The question is not whether to influence choice, but whether to do so thoughtfully and transparently, with genuine respect for human autonomy, or carelessly, allowing those with the most to gain from manipulation to design the architecture of our decisions.`,
    },
  ];

  for (const article of articles) {
    const existing = sqlite.prepare("SELECT id FROM articles WHERE title = ?").get(article.title);
    if (existing) continue;

    const content = tokenizeContent(article.content);
    const wordCount = content.reduce((sum, p) => sum + p.words.length, 0);

    const result = sqlite.prepare(
      "INSERT INTO articles (title, content, grade_level, category, author, background, source, source_type, word_count, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?)"
    ).run(
      article.title,
      JSON.stringify({ paragraphs: content }),
      article.grade_level,
      article.category,
      article.author,
      article.background,
      article.source,
      wordCount,
      1 // teacher@demo.com
    );

    const articleId = result.lastInsertRowid as number;

    // Add exercises for each article
    const exercises = getExercisesForArticle(article.title, articleId);
    for (const ex of exercises) {
      sqlite.prepare(
        "INSERT INTO exercises (article_id, type, question, options, answer, explanation, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(articleId, ex.type, ex.question, ex.options, ex.answer, ex.explanation, ex.orderIndex);
    }
  }

  console.log("Seed completed!");
}

function getExercisesForArticle(title: string, articleId: number) {
  const exerciseSets: Record<string, Array<{ type: string; question: string; options: string; answer: string; explanation: string; orderIndex: number }>> = {
    // ===== PRIMARY =====
    "The Lion and the Mouse": [
      { type: "detail", question: "What was the lion doing when the mouse first met him?", options: JSON.stringify(["Hunting for food", "Sleeping in the warm sun", "Playing with his cubs", "Drinking from the river"]), answer: "Sleeping in the warm sun", explanation: "文章第一句明确说明：'a mighty lion was sleeping peacefully in the warm afternoon sun'（一头威猛的狮子正在温暖的午后阳光下安睡）。过去进行时 'was sleeping' 表示过去某个时间点正在进行的动作。", orderIndex: 0 },
      { type: "detail", question: "Why did the lion decide to let the mouse go?", options: JSON.stringify(["He was afraid of the mouse", "Another animal begged for the mouse", "He was amused and feeling generous", "The mouse escaped on her own"]), answer: "He was amused and feeling generous", explanation: "文章明确说明狮子觉得老鼠要帮他的想法太可笑（'was so amused by this ridiculous idea that he roared with laughter'），但当时心情好（'feeling generous'），所以放了她。这题考查对因果关系细节的理解。", orderIndex: 1 },
      { type: "detail", question: "How did the mouse free the lion from the trap?", options: JSON.stringify(["She called other mice to help", "She gnawed through the ropes with her sharp teeth", "She dug a tunnel under the trap", "She found a knife and cut the ropes"]), answer: "She gnawed through the ropes with her sharp teeth", explanation: "文章写道：'began gnawing through the thick ropes with her small but very sharp teeth'（开始用她小而锋利的牙齿咬断粗绳）。动词 'gnaw' 意为啃咬，与选项中的 'chew' 意思相近。", orderIndex: 2 },
      { type: "main_idea", question: "What is the main lesson this fable teaches?", options: JSON.stringify(["Lions are the most dangerous animals in the forest", "Never trust someone who laughs at you", "Even the smallest friend can be a great helper someday", "Mice should stay away from large animals"]), answer: "Even the smallest friend can be a great helper someday", explanation: "这个寓言的核心主旨（moral）是：善良不会被浪费，即使是最弱小的生物也可能在关键时刻成为最有力的帮手。老鼠最后对狮子说的话点明了主题：'even the smallest creature can be a powerful friend'。", orderIndex: 3 },
      { type: "cloze", question: "The lion was caught in a hunter's ___ and could not break free.", options: JSON.stringify(["cage", "trap", "hole", "cave"]), answer: "trap", explanation: "文章明确写道 'he suddenly fell into a hunter's trap'（他突然掉进了猎人的陷阱）。'Trap' 意为陷阱，此处指用绳子做成的捕猎装置。'Net' 虽然在原文中没出现，但 'trap' 在这里是更准确的词汇。", orderIndex: 4 },
      { type: "grammar", question: "The lion ___ (sleep) peacefully when the mouse ran across his nose.", options: JSON.stringify(["sleeps", "slept", "was sleeping", "has been sleeping"]), answer: "was sleeping", explanation: "过去进行时（Past Continuous Tense）：was/were + 现在分词。这里描述过去某个时刻正在进行的动作（when the mouse ran across his nose），所以用过去进行时 'was sleeping'，表示在老鼠跑过鼻子这个动作发生时，狮子正在睡觉。", orderIndex: 5 },
      { type: "grammar", question: "\"If you spare my life today, I ___ (help) you someday,\" said the mouse.", options: JSON.stringify(["help", "helped", "will help", "would help"]), answer: "will help", explanation: "真实条件句（First Conditional）：If + 一般现在时, 主句用一般将来时（will + 动词原形）。老鼠说的是一个她认为可能实现的条件——如果狮子放了她，她将来会帮忙。所以用 'will help'。", orderIndex: 6 },
    ],
    // ===== MIDDLE SCHOOL =====
    "The Importance of Protecting Our Oceans": [
      { type: "detail", question: "According to the article, how much plastic enters the ocean each year?", options: JSON.stringify(["One million tons", "Five million tons", "Approximately eight million tons", "Twenty million tons"]), answer: "Approximately eight million tons", explanation: "文章第二句明确指出 'approximately eight million tons of plastic waste enters the ocean' every year，并通过一个生动的比喻（每分钟向海洋倾倒一垃圾车的塑料）来帮助读者理解这个数量。", orderIndex: 0 },
      { type: "detail", question: "How does plastic harm sea turtles specifically?", options: JSON.stringify(["Plastic cuts their flippers", "They mistake plastic bags for jellyfish and eat them", "Plastic poisons the water they swim in", "They get tangled in plastic fishing nets"]), answer: "They mistake plastic bags for jellyfish and eat them", explanation: "文章在论及塑料污染的危害时提到：'Sea turtles mistake floating plastic bags for jellyfish and eat them'（海龟将漂浮的塑料袋误认为水母而吞食）。这会导致消化道堵塞，最终饿死。", orderIndex: 1 },
      { type: "detail", question: "What happens to toxic chemicals from plastics when fish eat microplastics?", options: JSON.stringify(["The chemicals are immediately destroyed", "The chemicals can accumulate in the fish's body", "The fish excrete all the chemicals", "The chemicals only affect the water"]), answer: "The chemicals can accumulate in the fish's body", explanation: "文章解释了生物累积（bioaccumulation）的过程：'the toxic chemicals from those plastics can accumulate in their bodies'，当人类食用这些鱼时，毒素也会进入人体。", orderIndex: 2 },
      { type: "main_idea", question: "What is the article's main message about ocean plastic pollution?", options: JSON.stringify(["Scientists have solved the plastic pollution problem", "Plastic pollution harms marine life and humans, but everyone can help solve it", "Governments should ban all plastic immediately", "The ocean is too polluted to be saved"]), answer: "Plastic pollution harms marine life and humans, but everyone can help solve it", explanation: "文章前半部分说明塑料污染的严重性和危害，后半部分列举了各国已采取的措施和个人可以采取的行动。结尾句强调：'Every small action, multiplied by millions of people, can make an enormous difference.' 整体结构是问题-解决模式。", orderIndex: 3 },
      { type: "cloze", question: "By 2050, there could be more ___ than fish in the ocean by weight if current trends continue.", options: JSON.stringify(["ships", "plastic", "whales", "seaweed"]), answer: "plastic", explanation: "文章在第一段结尾引用科学家的预测：'there will be more plastic in the ocean than fish by weight'。这是一个令人震惊的对比，强调了问题的紧迫性。", orderIndex: 4 },
      { type: "grammar", question: "When humans eat fish that ___ (consume) microplastics, the toxins enter our bodies too.", options: JSON.stringify(["consume", "consumes", "have consumed", "consuming"]), answer: "have consumed", explanation: "定语从句中描述已完成的动作，用现在完成时 'have consumed'。鱼先吃了微塑料（completed action），然后人类吃鱼。现在完成时强调动作发生在过去但与现在有关联（鱼体内已积累了毒素）。", orderIndex: 5 },
      { type: "grammar", question: "Countries around the world ___ (take) action to reduce plastic waste in recent years.", options: JSON.stringify(["take", "took", "are taking", "were taking"]), answer: "are taking", explanation: "现在进行时 'are taking' 表示当前正在进行且持续的趋势。'in recent years' 虽然指向过去一段时间，但搭配现在进行时强调这个趋势仍在继续，尚未结束。", orderIndex: 6 },
    ],
    "The Amazing Journey of Monarch Butterflies": [
      { type: "detail", question: "How far can monarch butterflies travel during their migration?", options: JSON.stringify(["Up to 500 miles", "Up to 1,000 miles", "Up to 3,000 miles", "Up to 10,000 miles"]), answer: "Up to 3,000 miles", explanation: "文章开篇指出帝王蝶迁徙 'can span up to 3,000 miles'，从加拿大和美国北部飞往墨西哥中部的山区森林。", orderIndex: 0 },
      { type: "detail", question: "What makes the south-migrating generation of monarchs different from summer monarchs?", options: JSON.stringify(["They are much smaller", "They have different wing colors", "They live much longer — up to eight months", "They cannot fly as far"]), answer: "They live much longer — up to eight months", explanation: "文章解释：向南迁徙的这一代帝王蝶是特殊的 'Methuselah generation'，寿命长达8个月，而夏季的帝王蝶通常只活2-6周。", orderIndex: 1 },
      { type: "detail", question: "How do monarch butterflies find their way during migration?", options: JSON.stringify(["They follow other butterfly species", "They use the sun and possibly Earth's magnetic field", "They remember the route from previous trips", "They follow rivers and coastlines"]), answer: "They use the sun and possibly Earth's magnetic field", explanation: "文章提到帝王蝶使用内置的 '太阳指南针'（sun compass），通过触角中的生物钟来调整太阳位置的变化。在阴天可能还能感知地球磁场。", orderIndex: 2 },
      { type: "main_idea", question: "What is the main purpose of this article?", options: JSON.stringify(["To explain why monarch butterflies are endangered", "To describe the remarkable multi-generational migration of monarch butterflies", "To compare monarchs with other butterfly species", "To teach readers how to raise monarch butterflies at home"]), answer: "To describe the remarkable multi-generational migration of monarch butterflies", explanation: "文章以帝王蝶迁徙的壮观旅程为主线，解释了这场跨代迁徙的机制、导航方式和面临的挑战。整体结构是描述性的科普叙事。", orderIndex: 3 },
      { type: "cloze", question: "Monarch caterpillars depend on ___ plants for food, which have been disappearing due to farming and development.", options: JSON.stringify(["rose", "oak", "milkweed", "sunflower"]), answer: "milkweed", explanation: "文章提到 'The milkweed plants that monarch caterpillars depend on for food have been disappearing'。马利筋（milkweed）是帝王蝶幼虫唯一的食物来源。", orderIndex: 4 },
      { type: "grammar", question: "Each new generation of monarchs ___ (know) where to go without ever ___ (be) there before.", options: JSON.stringify(["knows / being", "know / be", "knew / been", "knows / been"]), answer: "knows / being", explanation: "第一空：'Each new generation' 作主语时谓语用单数 'knows'。第二空：介词 'without' 后接动名词 'being'。'Without ever being there before' 意为 '从未去过那里'。", orderIndex: 5 },
      { type: "grammar", question: "If milkweed plants continue to disappear, monarch populations ___ (decline) even further.", options: JSON.stringify(["decline", "will decline", "would decline", "declined"]), answer: "will decline", explanation: "真实条件句：If + 一般现在时, 主句用 will + 动词原形。这是一个可能发生的情况，用第一条件句结构表示对未来结果的预测。", orderIndex: 6 },
    ],
    // ===== HIGH SCHOOL =====
    "The Discovery of Penicillin: A Medical Revolution": [
      { type: "detail", question: "What did Fleming notice when he returned from his vacation in 1928?", options: JSON.stringify(["All his bacteria samples had died naturally", "A mold had contaminated one dish and bacteria around it had disappeared", "His laboratory had been cleaned by an assistant", "The petri dishes had been stolen"]), answer: "A mold had contaminated one dish and bacteria around it had disappeared", explanation: "文章详细描述了这一关键发现：Fleming 注意到一个培养皿被霉菌污染，霉菌周围的所有细菌都消失（disappeared）了。这体现了科学发现中机遇与观察力的结合。", orderIndex: 0 },
      { type: "detail", question: "Why did the initial scientific response to Fleming's discovery lack enthusiasm?", options: JSON.stringify(["Nobody believed his data", "Purifying penicillin was extremely difficult with existing equipment", "Fleming refused to share his findings", "World War I had just ended"]), answer: "Purifying penicillin was extremely difficult with existing equipment", explanation: "文章指出：'Extracting and purifying penicillin proved extremely difficult with the equipment available, and Fleming himself lacked the biochemical expertise to isolate the active compound.' 这说明从发现到应用之间还存在巨大的技术鸿沟。", orderIndex: 1 },
      { type: "detail", question: "What warning did Fleming give in his Nobel Prize lecture?", options: JSON.stringify(["That penicillin was too expensive for widespread use", "That overuse of antibiotics would lead to resistant bacteria", "That the Nobel Prize should be shared with more people", "That war would increase demand for antibiotics"]), answer: "That overuse of antibiotics would lead to resistant bacteria", explanation: "文章提到 Fleming 具有 'remarkable foresight'，在诺贝尔奖演讲中就警告了抗生素耐药性问题（antibiotic resistance），如今这个警告已被证明是非常有预见性的（tragically prophetic）。", orderIndex: 2 },
      { type: "main_idea", question: "What is the central theme of this article's account of the penicillin discovery?", options: JSON.stringify(["Scientific discoveries are usually accidental", "The discovery combined serendipity, perseverance, and wartime urgency", "British scientists are the best in the world", "Fleming should be the sole hero of the penicillin story"]), answer: "The discovery combined serendipity, perseverance, and wartime urgency", explanation: "文章通过三个阶段的叙述——Fleming 的偶然发现（serendipity）、牛津团队的坚持纯化（perseverance）、二战创造的量产动力（wartime urgency）——展示了重大科学突破通常是多种因素汇聚的结果。", orderIndex: 3 },
      { type: "cloze", question: "The mold that contaminated Fleming's dish belonged to the genus ___.", options: JSON.stringify(["Staphylococcus", "Penicillium", "Streptococcus", "Aspergillus"]), answer: "Penicillium", explanation: "Fleming 将这种霉菌鉴定为青霉属（Penicillium notatum），一种常见于腐烂水果和面包上的真菌。青霉素（penicillin）的名字就来源于此。", orderIndex: 4 },
      { type: "grammar", question: "Fleming ___ (study) Staphylococcus bacteria for years before he ___ (make) his famous discovery.", options: JSON.stringify(["studied / makes", "had been studying / made", "has studied / has made", "was studying / has made"]), answer: "had been studying / made", explanation: "过去完成进行时 'had been studying' 表示在过去某个点（1928年发现）之前持续进行的动作（研究细菌多年），强调持续性和先时性。主句动作 'made' 用一般过去时。", orderIndex: 5 },
      { type: "grammar", question: "Had Fleming not noticed the mold, penicillin ___ (may / never / discover) for many more years.", options: JSON.stringify(["may never discover", "might never have been discovered", "may never be discovered", "might never discover"]), answer: "might never have been discovered", explanation: "虚拟语气与过去事实相反的假设：Had + 主语 + 过去分词..., 主语 + might + have been + 过去分词。青霉素是被发现的，所以用被动语态。", orderIndex: 6 },
    ],
    "Should High School Students Work Part-Time?": [
      { type: "detail", question: "According to University of Michigan research cited in the article, what benefits did students who worked moderate hours report?", options: JSON.stringify(["Higher grades in all subjects", "Higher self-esteem and better time management", "Increased popularity among peers", "Less interest in college education"]), answer: "Higher self-esteem and better time management", explanation: "文章引用了密歇根大学 Monitoring the Future 项目自1976年以来的研究发现：适度工作的学生表现出 'higher self-esteem, greater sense of responsibility, and better time management skills'。", orderIndex: 0 },
      { type: "detail", question: "According to the National Research Council study, what negative effects were associated with working more than 20 hours per week?", options: JSON.stringify(["Improved physical health", "Better relationships with teachers", "Lower grades and higher rates of substance use", "Increased participation in sports"]), answer: "Lower grades and higher rates of substance use", explanation: "文章明确指出：工作超过20小时/周的学生成绩显著下降并有更高的物质滥用率。当工作、学校、作业和课外活动时间冲突时，牺牲的往往是睡眠。", orderIndex: 1 },
      { type: "detail", question: "What does the article recommend as an ideal number of work hours for students during the school year?", options: JSON.stringify(["5 to 8 hours per week", "10 to 12 hours per week", "15 to 20 hours per week", "20 to 25 hours per week"]), answer: "10 to 12 hours per week", explanation: "文章结论部分建议：'Working 10 to 12 hours per week during the school year appears to provide the benefits of employment without imposing significant academic costs.' 即10-12小时/周是最佳平衡点。", orderIndex: 2 },
      { type: "main_idea", question: "What is the article's overall position on student part-time employment?", options: JSON.stringify(["All student employment should be banned", "Students should work as many hours as possible", "Moderate work is beneficial, but excessive hours are harmful — decisions should be individualized", "The research is too contradictory to draw any conclusions"]), answer: "Moderate work is beneficial, but excessive hours are harmful — decisions should be individualized", explanation: "文章呈现了一个平衡的观点：承认适度工作的好处，同时警告过度工作的风险，最终建议因人而异（individualized）。这是一个典型的议论文 'balanced argument' 结构。", orderIndex: 3 },
      { type: "cloze", question: "Students who earn their own money through work tend to think twice before spending it ___.", options: JSON.stringify(["carefully", "impulsively", "generously", "frequently"]), answer: "impulsively", explanation: "文章提到：'when you have earned the money yourself through hours of work, you think twice before spending it impulsively.' 自己辛苦赚来的钱不会冲动消费（impulsively），这锻炼了理财能力。", orderIndex: 4 },
      { type: "grammar", question: "If a student ___ (work) more than 20 hours per week, their grades ___ (suffer) significantly.", options: JSON.stringify(["works / suffer", "works / will suffer", "worked / would suffer", "work / suffer"]), answer: "works / will suffer", explanation: "真实条件句（First Conditional）：If + 主语 + 一般现在时, 主语 + will + 动词原形。这是一个可能发生的情况，不是虚拟假设。", orderIndex: 5 },
      { type: "grammar", question: "Students who ___ (work) moderate hours report higher self-esteem than those who ___ (not work) at all.", options: JSON.stringify(["work / do not work", "works / does not work", "working / not working", "worked / not worked"]), answer: "work / do not work", explanation: "主语 'Students' 和 'those' 都是复数，定语从句中谓语用原形 work。否定形式用 'do not work'。复数主谓一致是常见的语法考点。", orderIndex: 6 },
    ],
    // ===== CET-4 =====
    "The Sharing Economy: Redefining Ownership in the Digital Age": [
      { type: "detail", question: "According to the article, what percentage of time is the average car parked?", options: JSON.stringify(["50%", "75%", "85%", "95%"]), answer: "95%", explanation: "文章指出大多数资产大部分时间处于闲置状态，以汽车为例：'The average car is parked 95% of the time'（普通汽车95%的时间都停着），这体现了共享经济的核心逻辑——利用闲置资源创造价值。", orderIndex: 0 },
      { type: "detail", question: "What are the three benefits of the sharing economy mentioned in the article?", options: JSON.stringify(["Lower taxes, more jobs, better roads", "Owners earn income, users get lower-cost access, society uses resources more efficiently", "Faster travel, cheaper products, improved education", "Higher wages, better working conditions, more vacation time"]), answer: "Owners earn income, users get lower-cost access, society uses resources more efficiently", explanation: "文章第二段结尾总结了共享经济的三重利益（triple benefit）：拥有者赚取额外收入、使用者以更低成本获得服务、社会更高效地利用资源。", orderIndex: 1 },
      { type: "detail", question: "What is one major criticism of sharing economy platforms regarding worker protections?", options: JSON.stringify(["Workers are forced to work excessively long hours", "Platform workers lack traditional employment protections like minimum wage and health insurance", "Platforms prevent workers from quitting", "Workers must pay high union fees"]), answer: "Platform workers lack traditional employment protections like minimum wage and health insurance", explanation: "文章指出批评者认为平台工作者缺乏传统雇佣保护：'no minimum wage guarantees, no health insurance, no paid sick leave, and no job security'。", orderIndex: 2 },
      { type: "main_idea", question: "What is the article's central argument about the sharing economy?", options: JSON.stringify(["The sharing economy should be banned due to unfair competition", "The sharing economy delivers genuine value, but societies need to develop appropriate regulatory frameworks", "Traditional industries will inevitably be destroyed by sharing platforms", "Only technology companies benefit from the sharing economy"]), answer: "The sharing economy delivers genuine value, but societies need to develop appropriate regulatory frameworks", explanation: "文章最后一段点明了全文主旨：问题不是共享经济是否会继续发展，而是'whether societies can develop regulatory frameworks that preserve its benefits while protecting workers, consumers, and communities'。", orderIndex: 3 },
      { type: "cloze", question: "Sharing platforms unlock value that was previously ___ by connecting owners with people who need temporary access to their assets.", options: JSON.stringify(["created", "wasted", "measured", "ignored"]), answer: "wasted", explanation: "文章的核心逻辑：闲置资产代表被浪费的价值。原文使用 'unlock value that was previously wasted' 这一表达。共享经济通过提高资源利用率来减少浪费。", orderIndex: 4 },
      { type: "grammar", question: "The fundamental question is not whether the sharing economy ___ (continue) to grow, but how societies ___ (can / develop) appropriate regulations.", options: JSON.stringify(["continues / can develop", "will continue / can develop", "continued / could develop", "continuing / developing"]), answer: "will continue / can develop", explanation: "第一空使用将来时 'will continue' 表示对未来趋势的判断。第二空 'can develop' 表示能力/可能性。整个句子是一个表语从句，句式 'the question is not whether... but how...' 是高级写作中常用的对比结构。", orderIndex: 5 },
      { type: "grammar", question: "By connecting owners with users, sharing platforms ___ (create) new economic opportunities for millions of people so far.", options: JSON.stringify(["created", "have created", "were creating", "create"]), answer: "have created", explanation: "现在完成时 'have created' 搭配时间状语 'so far'，表示从过去开始持续到现在的结果。'So far' 和 'since'、'up to now' 一样，通常与现在完成时连用。", orderIndex: 6 },
    ],
    "Why Sleep Matters More Than You Think": [
      { type: "detail", question: "According to the article, how does cognitive performance after 17-19 hours awake compare to alcohol intoxication?", options: JSON.stringify(["It is completely unaffected", "It drops to the level of a blood alcohol concentration of 0.05%", "It becomes significantly better than normal", "It only affects memory, not reasoning"]), answer: "It drops to the level of a blood alcohol concentration of 0.05%", explanation: "文章对比了睡眠不足和酒精中毒对认知的影响：清醒17-19小时后，认知表现降至血液酒精浓度0.05%的水平。这是将抽象的科学发现转化为普通人容易理解的概念。", orderIndex: 0 },
      { type: "detail", question: "What is the glymphatic system and why is it important?", options: JSON.stringify(["A system that controls hunger — it prevents overeating", "The brain's cleaning system that removes toxic proteins during deep sleep", "A hormone system that regulates body temperature", "A neural pathway that improves vision"]), answer: "The brain's cleaning system that removes toxic proteins during deep sleep", explanation: "文章用大量篇幅介绍了2012年发现的类淋巴系统（glymphatic system）：在深度睡眠期间，脑细胞缩小约60%，脑脊液流经扩大的空间，清洗有毒蛋白质（包括与阿尔茨海默症相关的β-淀粉样蛋白）。", orderIndex: 1 },
      { type: "detail", question: "What happens to the amygdala when a person is sleep-deprived?", options: JSON.stringify(["It becomes less active", "It becomes hyperactive, producing exaggerated emotional responses", "It stops functioning completely", "It converts short-term memories to long-term ones"]), answer: "It becomes hyperactive, producing exaggerated emotional responses", explanation: "文章解释：睡眠不足时杏仁核（amygdala）变得过度活跃（hyperactive），同时前额叶皮层（prefrontal cortex）——通常负责理性控制情绪反应——活动降低。这解释了为什么睡眠不足后小事也会感觉像灾难。", orderIndex: 2 },
      { type: "main_idea", question: "What is the central argument of this article?", options: JSON.stringify(["Technology is destroying our sleep patterns", "Sleep is not a passive state but an active biological process essential for learning, emotion, and brain health", "Students should sleep more during exams", "The glymphatic system is the only important brain function"]), answer: "Sleep is not a passive state but an active biological process essential for learning, emotion, and brain health", explanation: "文章以'睡眠长期以来被视为被动状态'开头，随后通过认知、情感和神经科学三个维度的论证，全面展示了睡眠是一个活跃的、不可或缺的生物过程。结尾引用神经科学家Matthew Walker的话强化主旨。", orderIndex: 3 },
      { type: "cloze", question: "During deep sleep, the brain's cleaning system washes away ___ proteins that accumulate in the brains of Alzheimer's patients.", options: JSON.stringify(["insulin", "beta-amyloid", "hemoglobin", "collagen"]), answer: "beta-amyloid", explanation: "文章明确指出类淋巴系统清除的毒性蛋白包括 'beta-amyloid—the protein that accumulates in the brains of Alzheimer's patients'。这是睡眠不足可能增加神经退行性疾病风险的关键证据。", orderIndex: 4 },
      { type: "grammar", question: "Sleep, which many people view as an inconvenience, ___ (be) actually an extraordinarily active biological process.", options: JSON.stringify(["are", "is", "were", "have been"]), answer: "is", explanation: "主语是 'Sleep'（单数），非限制性定语从句 'which many people view as an inconvenience' 是插入语，不影响主谓一致。谓语用单数 'is'。这是一个常见的语法陷阱——不要因为插入成分而误解主语。", orderIndex: 5 },
      { type: "grammar", question: "If people ___ (understand) how important sleep is, they ___ (not sacrifice) it so readily.", options: JSON.stringify(["understand / will not sacrifice", "understood / would not sacrifice", "had understood / will not have sacrificed", "understand / would not sacrifice"]), answer: "understood / would not sacrifice", explanation: "虚拟语气，与现在事实相反的假设：If + 主语 + 过去式（were/did）, 主语 + would + 动词原形。现实中人们没有充分理解睡眠的重要性，所以仍在牺牲它。", orderIndex: 6 },
    ],
    // ===== CET-6 =====
    "Artificial Intelligence and the Future of Employment": [
      { type: "detail", question: "According to the Science study cited in the article, what percentage of occupations could be fully automated with current technology?", options: JSON.stringify(["Over 50%", "About 25%", "Fewer than 5%", "Nearly 100%"]), answer: "Fewer than 5%", explanation: "文章引用《科学》杂志的研究：虽然几乎所有工作都包含可自动化的任务，但能被当前技术完全自动化（fully automated）的职业不到5%。这是一个关键的数据，纠正了'AI将取代所有工作'的流行误解。", orderIndex: 0 },
      { type: "detail", question: "What types of skills does the article suggest AI systems struggle with?", options: JSON.stringify(["Mathematical calculations and data processing", "Genuine creativity, complex social interaction, ethical judgment, and knowledge integration across domains", "Repetitive physical tasks", "Basic translation and transcription"]), answer: "Genuine creativity, complex social interaction, ethical judgment, and knowledge integration across domains", explanation: "文章在第三段指出AI不擅长的领域：'tasks requiring genuine creativity, complex social interaction, ethical judgment, and the integration of knowledge across widely different domains'——恰恰是专家级人类表现的核心特征。", orderIndex: 1 },
      { type: "detail", question: "According to the World Economic Forum, what is the net job impact of AI projected to be by 2030?", options: JSON.stringify(["A loss of 85 million jobs with no new ones", "A net gain of 12 million jobs (97 million created minus 85 million displaced)", "No change in total employment", "A loss of 97 million jobs"]), answer: "A net gain of 12 million jobs (97 million created minus 85 million displaced)", explanation: "文章引用世界经济论坛预测：AI将消除8500万个工作岗位，同时创造9700万个新岗位，净增1200万个。但文章也强调这些新岗位需要不同的技能，地点也可能不同。", orderIndex: 2 },
      { type: "main_idea", question: "What is the author's main argument about AI and employment?", options: JSON.stringify(["AI will inevitably lead to mass unemployment", "The key challenge is managing the transition so that AI-driven prosperity is broadly shared", "Only developed countries need to worry about AI", "Governments should ban AI to protect workers"]), answer: "The key challenge is managing the transition so that AI-driven prosperity is broadly shared", explanation: "文章结尾总结了核心论点：政策挑战在于确保AI驱动生产力增长的利益得到广泛分享（shared broadly），而不是集中在资本拥有者和少数高技能知识工作者手中。失败的国家可能面临不平等加剧和社会不稳定。", orderIndex: 3 },
      { type: "cloze", question: "Educational systems designed for the ___ era are poorly suited to developing the skills that modern workplaces require.", options: JSON.stringify(["digital", "industrial", "agricultural", "information"]), answer: "industrial", explanation: "文章指出工业时代设计的教育体系——标准化课程、固定时间表、强调记忆——不适合培养AI时代所需的能力。这是对传统教育模式的批判性反思。", orderIndex: 4 },
      { type: "cloze", question: "The skills employers now value are shifting toward those that ___ AI rather than compete with it.", options: JSON.stringify(["replace", "complement", "eliminate", "ignore"]), answer: "complement", explanation: "文章明确指出未来技能将转向与AI互补（complement）而非竞争的领域。Complement 意为补充/互补，强调人机协作而非对抗。", orderIndex: 5 },
      { type: "grammar", question: "Rather than ___ (view) AI as a threat, progressive organizations ___ (focus) on human-machine collaboration.", options: JSON.stringify(["to view / focus", "viewing / are focusing", "view / focused", "viewing / focus"]), answer: "viewing / are focusing", explanation: "第一空：'Rather than' 后接动名词 'viewing'。第二空：现在进行时 'are focusing' 表示当前正在进行的趋势。整句结构：Rather than + doing X, Y + is/are doing Z。", orderIndex: 6 },
      { type: "grammar", question: "By 2030, AI ___ (displace) approximately 85 million jobs while simultaneously ___ (create) 97 million new ones.", options: JSON.stringify(["displaces / creates", "displaced / created", "will have displaced / creating", "has displaced / created"]), answer: "will have displaced / creating", explanation: "'By + 将来时间' 提示使用将来完成时 'will have displaced'，表示到那时已经完成的动作。'While simultaneously creating' 中 while 后省略了主语和be动词，直接用现在分词作伴随状语。这是学术英语中常见的高级句式。", orderIndex: 7 },
    ],
    "The Psychology of Habit Formation": [
      { type: "detail", question: "According to the research cited, approximately what percentage of daily behaviors are automatic habits rather than conscious decisions?", options: JSON.stringify(["20-25%", "30-35%", "40-45%", "60-65%"]), answer: "40-45%", explanation: "文章引用研究数据：大约40-45%的日常行为不是有意识的决定，而是自动化的习惯。这个数据强调了理解习惯形成机制对于个人发展的重要性。", orderIndex: 0 },
      { type: "detail", question: "Where does the widely cited \"21-day rule\" for habit formation actually come from?", options: JSON.stringify(["A rigorous psychological study from Harvard", "A plastic surgeon's observation about patient recovery", "Ancient Greek philosophy", "A World Health Organization report"]), answer: "A plastic surgeon's observation about patient recovery", explanation: "文章揭露了'21天法则'的真相：它源于一位整形外科医生对患者术后适应新面孔所需时间的轶事观察，没有严格的科学依据。实际研究显示习惯形成需要18到254天不等。", orderIndex: 1 },
      { type: "detail", question: "What are implementation intentions and why are they effective?", options: JSON.stringify(["Vague goals that allow flexibility", "Specific if-then plans that specify when, where, and how to perform a behavior", "Rewards given after completing a task", "Punishments for failing to maintain habits"]), answer: "Specific if-then plans that specify when, where, and how to perform a behavior", explanation: "文章详细介绍：实施意图（implementation intentions）是具体的'如果-那么'计划，如'吃完早饭后，我会在书桌前读20分钟英语文章'。Gollwitzer的研究表明制定实施意图的人实现目标的可能性是一般人的2-3倍。", orderIndex: 2 },
      { type: "main_idea", question: "What is the key takeaway about habit formation for language learners?", options: JSON.stringify(["Studying for long hours on weekends is the most efficient approach", "Short daily practice is more effective than occasional intensive study because it builds automatic neural pathways", "Habits cannot be changed after age 25", "Willpower alone is sufficient for building study habits"]), answer: "Short daily practice is more effective than occasional intensive study because it builds automatic neural pathways", explanation: "文章的实践应用部分明确提出：每天20分钟英语练习比每周末4小时集中学习效果更好，因为日常练习建立了支持流利语言使用的自动化神经通路（automatic neural pathways）。这与神经科学家Hebb的理论呼应。", orderIndex: 3 },
      { type: "cloze", question: "The brain's shift of behavior control from the prefrontal cortex to the ___ is what makes habits automatic.", options: JSON.stringify(["cerebellum", "basal ganglia", "hippocampus", "amygdala"]), answer: "basal ganglia", explanation: "文章解释了习惯的神经科学基础：新行为最初在前额叶皮层（消耗大量脑力）处理，随着重复，控制权逐渐转移到基底神经节（basal ganglia），使行为变得自动化。", orderIndex: 4 },
      { type: "grammar", question: "The more consistently you practice, the more automatic the behavior ___ (become).", options: JSON.stringify(["became", "becomes", "has become", "is becoming"]), answer: "becomes", explanation: "'The more..., the more...' 结构（越……越……）中两个分句都用一般现在时。这是英语中表示比例关系的常用句型，两个比较级分句时态一致。", orderIndex: 5 },
      { type: "grammar", question: "\"Neurons that fire together, ___ together\" — Donald Hebb's principle ___ (summarize) the neurological basis of habit formation.", options: JSON.stringify(["wire / summarizes", "wired / summarizing", "to wire / summarized", "wiring / summarize"]), answer: "wire / summarizes", explanation: "第一空：谚语/格言中使用一般现在时 'wire'。第二空：主语 'principle' 为单数，谓语用第三人称单数 'summarizes'。Hebb定律简洁地概括了习惯形成的神经基础。", orderIndex: 6 },
    ],
    // ===== TEM-4 =====
    "Cultural Intelligence in Global Business Communication": [
      { type: "detail", question: "According to Edward T. Hall's framework, what characterizes high-context cultures?", options: JSON.stringify(["Communication is always written rather than spoken", "Much of the meaning is carried by context — relationships, shared knowledge, nonverbal cues", "All information must be stated explicitly without ambiguity", "Only formal language is used in business"]), answer: "Much of the meaning is carried by context — relationships, shared knowledge, nonverbal cues", explanation: "文章详细阐述了Hall的高/低语境理论：在高语境文化（如日本、中国、阿拉伯国家）中，大量含义由语境承载——说话者之间的关系、环境、共享文化知识和非语言线索。直接说'不'在这种文化中可能被视为破坏关系。", orderIndex: 0 },
      { type: "detail", question: "According to the article, what is the foundational insight of cross-cultural communication research?", options: JSON.stringify(["All cultures communicate in fundamentally the same way", "Meaning is not transmitted but constructed by both speaker and listener", "Translation software can solve all cross-cultural problems", "English is sufficient for all international business"]), answer: "Meaning is not transmitted but constructed by both speaker and listener", explanation: "文章提出跨文化交际研究的核心洞见：意义不是被传递的，而是被构建的（'Meaning is not transmitted but constructed'）。同样的词句在不同文化框架下会产生完全不同的理解。", orderIndex: 1 },
      { type: "detail", question: "How does the article describe true cultural intelligence, as opposed to memorizing cultural dos and don'ts?", options: JSON.stringify(["Learning multiple languages fluently", "The ability to recognize when cultural differences are at play, suspend judgment, and adapt behavior flexibly", "Traveling to as many countries as possible", "Following strict protocols for each culture"]), answer: "The ability to recognize when cultural differences are at play, suspend judgment, and adapt behavior flexibly", explanation: "文章在最后一段将真正的文化智商定义为：识别文化差异何时在起作用、暂时悬置基于自身文化背景的判断、灵活适应文化环境的能力。这是一种技能，可以通过刻意练习来提高。", orderIndex: 2 },
      { type: "main_idea", question: "What is the central argument of this article?", options: JSON.stringify(["Japanese business culture is superior to Western business culture", "Cultural intelligence is a core professional competence, not a supplementary skill, in today's global economy", "Translation problems are the main cause of business failures", "Companies should only hire employees from diverse cultural backgrounds"]), answer: "Cultural intelligence is a core professional competence, not a supplementary skill, in today's global economy", explanation: "文章结尾明确总结了核心论点：'cultural intelligence is no longer a supplementary skill but a core professional competence'（文化智商不再是补充技能，而是核心职业素养）。全文通过理论框架、具体案例和批判性分析支撑这一论点。", orderIndex: 3 },
      { type: "cloze", question: "A direct refusal in a high-context culture may be considered rude not because of the refusal itself but because making it ___ violates the relationship.", options: JSON.stringify(["implicit", "explicit", "polite", "temporary"]), answer: "explicit", explanation: "文章解释：在高语境文化中，直接说'不'被视为无礼，不是因为拒绝本身，而是因为使拒绝变得明确（explicit）破坏了关系。隐含的拒绝保留了双方的面子，而明确的拒绝则不然。", orderIndex: 4 },
      { type: "grammar", question: "Negotiation strategies that ___ (work) well in one culture ___ (can / backfire) in another.", options: JSON.stringify(["work / can backfire", "works / can backfire", "worked / backfire", "are working / backfired"]), answer: "work / can backfire", explanation: "第一空：'that' 引导定语从句修饰复数名词 'strategies'，谓语用原形 'work'。第二空：'can' 是情态动词，后接动词原形 'backfire'。情态动词没有时态和人称的变化。", orderIndex: 5 },
      { type: "grammar", question: "Rather than simply memorizing cultural rules, developing genuine CQ ___ (require) curiosity about how others make sense of the world.", options: JSON.stringify(["require", "requires", "required", "requiring"]), answer: "requires", explanation: "主语是动名词短语 'developing genuine CQ'（不是 'memorizing'），动名词短语作主语时谓语用单数 'requires'。'Rather than...' 结构引导的是比较成分，不是主语。", orderIndex: 6 },
    ],
    "The Digital Humanities: When Literature Meets Data Science": [
      { type: "detail", question: "What does Franco Moretti's concept of \"distant reading\" involve?", options: JSON.stringify(["Reading books from a physical distance to protect eyesight", "Examining thousands of books as data points to discover macro-level literary patterns", "Reading only summaries of books rather than full texts", "Using speed-reading techniques"]), answer: "Examining thousands of books as data points to discover macro-level literary patterns", explanation: "文章详细介绍了Franco Moretti的'远读'概念：将成千上万本书当作数据点，从中提取宏观层面的文学模式。与传统'细读'（close reading）不同，远读关注的是跨越体裁、时期和国家文学的大规模模式。", orderIndex: 0 },
      { type: "detail", question: "How has stylometry contributed to literary scholarship according to the article?", options: JSON.stringify(["It has proven Shakespeare did not write his plays", "It has resolved authorship disputes by quantitative analysis of word frequencies and sentence patterns", "It has determined the most popular book genres", "It has translated ancient texts automatically"]), answer: "It has resolved authorship disputes by quantitative analysis of word frequencies and sentence patterns", explanation: "文章以16世纪西班牙匿名戏剧被计算分析确认可能是塞万提斯早期作品为例，说明了风格计量学（stylometry）如何通过分析词频、句长和语法模式来解决作者归属争议。", orderIndex: 1 },
      { type: "detail", question: "According to the article, what does the Science study of 5 million digitized books demonstrate?", options: JSON.stringify(["That people are reading fewer books", "That a quantitative history of cultural evolution can be constructed through linguistic patterns", "That fiction is more popular than non-fiction", "That book quality has declined over time"]), answer: "That a quantitative history of cultural evolution can be constructed through linguistic patterns", explanation: "文章提到《科学》杂志发表的一项研究：分析了超过500万本数字化书籍中的语言模式，构建了通过人类书写词汇来反映文化演变的量化历史。这是数字人文研究的前沿成果。", orderIndex: 2 },
      { type: "main_idea", question: "What is the author's perspective on the relationship between traditional and digital humanities?", options: JSON.stringify(["Digital humanities will completely replace traditional methods", "The two approaches are complementary — computational methods reveal patterns that close readers can then investigate in depth", "Traditional humanities scholars should resist digital methods", "There is no valid way to combine the two approaches"]), answer: "The two approaches are complementary — computational methods reveal patterns that close readers can then investigate in depth", explanation: "文章通过望远镜和肉眼天文学的比喻来阐明立场：数字人文不会使传统文学研究过时，而是提供了一种新的工具。计算方法和细读方法是互补的（complementary），而非竞争的。", orderIndex: 3 },
      { type: "cloze", question: "Topic modeling has mapped how themes like empire and industrialization ___ and fell across thousands of 19th-century British novels.", options: JSON.stringify(["rose", "raised", "arose", "risen"]), answer: "rose", explanation: "文章在描述主题建模（topic modeling）时使用 'rose and fell'（兴衰），rise/rose/risen 是不及物动词，在此意为'上升/兴起'。Raise 是及物动词，需要宾语。搭配 'how themes rose and fell'。", orderIndex: 4 },
      { type: "grammar", question: "Had scholars not digitized vast collections of texts, they ___ (not / be / able) to discover macro-level literary patterns.", options: JSON.stringify(["would not be able", "would not have been able", "will not be able", "are not able"]), answer: "would not have been able", explanation: "虚拟语气与过去事实相反的假设：Had + 主语 + 过去分词..., 主语 + would + have + been + able to。表示对已完成动作的假设（如果没有数字化，就不可能发现宏观文学模式）。", orderIndex: 5 },
      { type: "grammar", question: "The challenge for the next generation of humanities scholars is ___ (become) literate in both interpretive traditions and computational methods.", options: JSON.stringify(["become", "becomes", "to become", "becoming"]), answer: "to become", explanation: "不定式 'to become' 作表语，说明主语 'challenge' 的具体内容。句式 'The challenge is to do something' 是学术英语中表达目标和任务的常见结构。", orderIndex: 6 },
    ],
    // ===== TEM-8 =====
    "Postmodernism and the Crisis of Narrative in Contemporary Fiction": [
      { type: "detail", question: "How does Lyotard define the postmodern condition?", options: JSON.stringify(["As a return to traditional storytelling forms", "As incredulity toward metanarratives — skepticism toward grand explanatory stories", "As the triumph of technology over literature", "As the complete rejection of all fictional writing"]), answer: "As incredulity toward metanarratives — skepticism toward grand explanatory stories", explanation: "文章引用了Lyotard的经典定义：后现代状况即'对元叙事的怀疑'（incredulity toward metanarratives）——对现代性用来解释历史的各种宏大叙事（启蒙进步论、马克思主义阶级斗争论、资本主义市场最优论）的深度不信任。", orderIndex: 0 },
      { type: "detail", question: "What narrative techniques does the article associate with postmodern fiction?", options: JSON.stringify(["Omniscient narrators and linear plots", "Breaking the fourth wall, multiple contradictory narrators, and refusal of narrative closure", "Simple vocabulary and short sentences", "Traditional hero journeys with happy endings"]), answer: "Breaking the fourth wall, multiple contradictory narrators, and refusal of narrative closure", explanation: "文章列举了后现代小说的典型技法：打破'第四面墙'提醒读者正在阅读人工构建物（而非现实的透明窗口）、多重矛盾叙述者取代单一权威声音、结尾拒绝封闭而提供模糊或自我矛盾。", orderIndex: 1 },
      { type: "detail", question: "What critique did Habermas make of postmodernism?", options: JSON.stringify(["Postmodernism is too focused on science", "Abandoning the Enlightenment project of reason and emancipation risks enabling domination", "Postmodern literature is too difficult to read", "Postmodernism ignores the role of the author"]), answer: "Abandoning the Enlightenment project of reason and emancipation risks enabling domination", explanation: "文章介绍了哈贝马斯对后现代主义的著名批评：启蒙运动的理性和解放事业尚未完成而非失败，完全放弃它可能让批判理论本应反对的统治力量有机可乘。This debate remains unresolved。", orderIndex: 2 },
      { type: "detail", question: "How does the article characterize David Foster Wallace's approach to postmodernism?", options: JSON.stringify(["He rejected all postmodern techniques entirely", "He sought to reclaim emotional and moral seriousness using sophisticated narrative techniques to construct meaning more honestly", "He believed postmodernism was the only valid literary form", "He argued for a return to 19th-century narrative conventions"]), answer: "He sought to reclaim emotional and moral seriousness using sophisticated narrative techniques to construct meaning more honestly", explanation: "文章指出Wallace提出了向'sincerity'和'single-entendre principles'的转向——试图用复杂的叙事技巧不是为了解构意义而是为了更诚实地构建它，在不沦入虚无主义的前提下承认复杂性。", orderIndex: 3 },
      { type: "main_idea", question: "What is the article's conclusion about postmodernism's impact on contemporary fiction?", options: JSON.stringify(["Postmodernism was a passing fad with no lasting influence", "Postmodernism has permanently changed literary possibility by making narrative conventions visible as choices", "Postmodernism has made traditional storytelling impossible", "Writers should ignore postmodern insights and return to traditional forms"]), answer: "Postmodernism has permanently changed literary possibility by making narrative conventions visible as choices", explanation: "文章结尾总结了后现代主义的持久影响：即使是传统结构的当代小说也在写作时意识到叙事惯例只是选择而非自然形式。这种自觉使叙事更诚实。当代作家的挑战是利用这种复杂性服务于真正的情感和思想投入，而非被其困在反讽疏离的牢笼中。", orderIndex: 4 },
      { type: "cloze", question: "Postmodern fiction embraced fragmentation, paradox, and ___ uncertainty, rejecting the idea that stories should resolve neatly.", options: JSON.stringify(["ontological", "optical", "optimal", "optional"]), answer: "ontological", explanation: "文章在描述后现代小说的特征时使用了'ontological uncertainty'（本体论不确定性）这一哲学术语。Ontology 研究存在的本质——后现代小说质疑故事世界的本体地位，模糊现实与虚构的边界。", orderIndex: 5 },
      { type: "grammar", question: "The postmodern critique of narrative, ___ (challenge) the epistemological foundations of traditional storytelling, ___ (reshape) literary practice permanently.", options: JSON.stringify(["challenging / has reshaped", "challenged / reshaped", "to challenge / reshapes", "challenges / reshaping"]), answer: "challenging / has reshaped", explanation: "第一空：现在分词短语 'challenging...' 作非限制性定语，修饰主语 'critique'。第二空：现在完成时 'has reshaped' 表示从过去持续到现在的永久性影响。句意：后现代对叙事的批判永久性地重塑了文学实践。", orderIndex: 6 },
      { type: "grammar", question: "Whether this ___ (represent) a genuine new paradigm or merely a refinement of postmodern strategies ___ (remain) a subject of vigorous critical debate.", options: JSON.stringify(["represents / remains", "represent / remain", "representing / remaining", "represented / remained"]), answer: "represents / remains", explanation: "第一空：'Whether...or...' 引导的主语从句中，'this' 是单数，用 'represents'。第二空：整个主语从句 'Whether this represents...strategies' 作主语时视为单数，谓语用 'remains'。主语从句作主语时谓语用单数。", orderIndex: 7 },
    ],
    "The Neuroscience of Consciousness: Hard Problems and Emerging Paradigms": [
      { type: "detail", question: "What is David Chalmers' \"hard problem\" of consciousness?", options: JSON.stringify(["How to build artificial intelligence", "Why physical brain processes are accompanied by subjective experience at all", "How to treat disorders of consciousness", "Why some people are more conscious than others"]), answer: "Why physical brain processes are accompanied by subjective experience at all", explanation: "文章以Nagel的蝙蝠问题引入，然后提出Chalmers的'困难问题'：为什么物理的神经活动会伴随着主观体验？这个问题区别于解释具体认知功能（感知、记忆、注意）的'容易问题'。困难问题是哲学层面的：为什么大脑活动不是'在黑暗中'进行？", orderIndex: 0 },
      { type: "detail", question: "What does Integrated Information Theory (IIT) propose about consciousness?", options: JSON.stringify(["Only humans can be conscious", "Consciousness is a fundamental property of any system that integrates information in a particular way", "Consciousness is an illusion created by language", "Consciousness cannot be studied scientifically"]), answer: "Consciousness is a fundamental property of any system that integrates information in a particular way", explanation: "文章介绍了Tononi的整合信息理论：意识是任何以特定方式整合信息的系统的基本属性。该理论做出了一个惊人预测——意识不是二元的而是有程度差别的（graded），任何具有足够整合信息的系统都拥有某种程度的意识，甚至包括非生物系统。", orderIndex: 1 },
      { type: "detail", question: "How does the Global Workspace Theory explain conscious access?", options: JSON.stringify(["Consciousness is located in a single brain region", "Information from specialized unconscious processors is selected and broadcast to a global workspace accessible to multiple cognitive systems", "Consciousness exists outside the brain entirely", "All brain activity is conscious"]), answer: "Information from specialized unconscious processors is selected and broadcast to a global workspace accessible to multiple cognitive systems", explanation: "文章阐述了全局工作空间理论（GWT）：当来自专门的、无意识处理器的信息被选中并放大进入全局工作空间，使多个认知系统（包括记忆、注意、语言报告）能够获取时，意识就产生了。Dehaene的脑成像研究为这一理论提供了大量实证支持。", orderIndex: 2 },
      { type: "detail", question: "What is the predictive processing framework's view of consciousness?", options: JSON.stringify(["Consciousness is a mistake in brain computation", "Consciousness corresponds to the brain's highest-level predictions about sensory input causes", "Consciousness cannot be explained by any theory", "Consciousness is purely a social construct"]), answer: "Consciousness corresponds to the brain's highest-level predictions about sensory input causes", explanation: "文章介绍了预测处理框架：大脑不是被动的感觉接收器，而是主动的假设检验系统，不断生成关于感觉输入的预测并根据预测误差更新内部模型。意识可能对应这个层级中最高层的预测——大脑对感觉输入原因的最佳猜测。", orderIndex: 3 },
      { type: "main_idea", question: "What is the article's overall assessment of consciousness research?", options: JSON.stringify(["The hard problem has been definitively solved", "Consciousness research has moved from the margins to a dynamic frontier, but whether the hard problem will yield to science remains uncertain", "All theories of consciousness are equally valid", "Consciousness should only be studied by philosophers"]), answer: "Consciousness research has moved from the margins to a dynamic frontier, but whether the hard problem will yield to science remains uncertain", explanation: "文章结尾总结了全文立场：意识研究已从可敬科学的边缘走向最具活力的前沿之一，汇聚了神经科学家、哲学家、物理学家和计算机科学家。但困难问题是否会最终屈服于科学探索，还是代表了客观方法的基本极限，仍然不确定。", orderIndex: 4 },
      { type: "cloze", question: "Current quantum processors must be cooled to temperatures colder than ___ space to minimize environmental interference.", options: JSON.stringify(["outer", "inner", "interstellar", "atmospheric"]), answer: "interstellar", explanation: "（此题来自量子计算文章，用于TEM-8级别的跨体裁训练）文章描述量子处理器的极端工作条件：'cooled to temperatures colder than interstellar space'（被冷却到比星际空间更冷的温度）。Interstellar 意为星际之间的。", orderIndex: 5 },
      { type: "grammar", question: "Some argue that once we ___ (explain) all cognitive functions, there ___ (be) nothing left to explain about consciousness.", options: JSON.stringify(["explain / will be", "have explained / is", "will explain / was", "explained / would be"]), answer: "have explained / is", explanation: "第一空：'Once' 引导的时间状语从句用现在完成时 'have explained' 强调动作的完成。第二空：主句用一般现在时 'is' 表达一般性论断。这是 'once + present perfect, main clause present simple' 的结构模式。", orderIndex: 6 },
      { type: "grammar", question: "___ (be) consciousness a fundamental property of the universe, it ___ (require) an expansion of our scientific ontology.", options: JSON.stringify(["Were / would require", "Was / required", "Is / requires", "Being / requiring"]), answer: "Were / would require", explanation: "虚拟语气倒装句：If consciousness were a fundamental property → Were consciousness a fundamental property（省略if并倒装）。主句用 'would require'。这是学术写作中的高级句式，用于表达假设性条件。", orderIndex: 7 },
    ],
    // ===== IELTS =====
    "Urbanization and Environmental Sustainability in the 21st Century": [
      { type: "detail", question: "According to UN projections cited in the article, what proportion of the global population is expected to live in cities by 2050?", options: JSON.stringify(["45%", "56%", "68%", "80%"]), answer: "68%", explanation: "文章引用联合国预测：城市人口比例将从2024年的56%增长到2050年的68%（'a figure projected to reach 68% by 2050'）。这是理解城市化规模的关键数据。", orderIndex: 0 },
      { type: "detail", question: "How much less greenhouse gas per capita do compact cities produce compared to sprawling cities, according to the article?", options: JSON.stringify(["10-20% less", "30-50% less", "60-70% less", "80-90% less"]), answer: "30-50% less", explanation: "文章指出：'compact cities produce 30 to 50 percent less greenhouse gas per capita than their sprawling counterparts'（紧凑型城市的人均温室气体排放比蔓延型城市低30-50%）。这是文章支持高密度城市发展的关键论据。", orderIndex: 1 },
      { type: "detail", question: "What ecosystem services does urban vegetation provide according to the article?", options: JSON.stringify(["Only aesthetic beauty", "Filtering air pollutants, absorbing stormwater, mitigating heat island effects, and providing wildlife habitat", "Increasing property values exclusively", "Producing food for city residents"]), answer: "Filtering air pollutants, absorbing stormwater, mitigating heat island effects, and providing wildlife habitat", explanation: "文章详细列举了城市植被的生态系统服务：过滤空气污染物、吸收暴雨径流、缓解城市热岛效应、为野生动物提供栖息地。还提到接触绿色空间可以显著降低抑郁、焦虑和压力相关疾病的发病率。", orderIndex: 2 },
      { type: "main_idea", question: "What central argument does the article make about the relationship between urbanization and environmental sustainability?", options: JSON.stringify(["Urbanization is inherently environmentally destructive and must be reversed", "The problem is not urbanization itself but how cities are designed and governed — compact, well-designed cities can be remarkably efficient", "Developing countries should stop urbanizing", "Environmental concerns are less important than economic growth"]), answer: "The problem is not urbanization itself but how cities are designed and governed — compact, well-designed cities can be remarkably efficient", explanation: "文章在第二段末提出核心论点：问题不在于城市化是否固有环境破坏性，而在于'how we build and manage cities rather than in urban density itself'（我们如何建设和管理城市，而非城市密度本身）。随后用紧凑型与蔓延型城市的对比数据来支撑这一观点。", orderIndex: 3 },
      { type: "cloze", question: "Urban heat islands are ___ where metropolitan areas experience significantly higher temperatures than surrounding rural regions.", options: JSON.stringify(["phenomena", "theories", "illusions", "measurements"]), answer: "phenomena", explanation: "文章定义城市热岛效应：'phenomena where metropolitan areas experience significantly higher temperatures than surrounding rural regions'。Phenomena 是 phenomenon 的复数形式，用于科学语境中的可观察现象。", orderIndex: 4 },
      { type: "grammar", question: "Cities that ___ (invest) in mass transit and green infrastructure ___ (demonstrate) that sustainability and quality of life can coexist.", options: JSON.stringify(["invest / demonstrate", "have invested / have demonstrated", "invested / would demonstrate", "are investing / demonstrated"]), answer: "have invested / have demonstrated", explanation: "现在完成时 'have invested' 和 'have demonstrated' 表示从过去到现在的持续状态和结果。文章列举哥本哈根、新加坡等城市作为已有成功案例的证据。定语从句和主句的时态应保持一致。", orderIndex: 5 },
      { type: "grammar", question: "Every city that ___ (expand) through sprawl rather than compact development ___ (commit) its future residents to higher energy costs.", options: JSON.stringify(["expands / commits", "expanded / committed", "is expanding / has committed", "expand / commit"]), answer: "expands / commits", explanation: "一般现在时 'expands' 和 'commits' 用于陈述一般性规律/真理。定语从句中 'that' 修饰单数 'Every city'，谓语用第三人称单数。主句同样用单数。", orderIndex: 6 },
    ],
    "The Economics of Healthcare: Market Failures and Policy Solutions": [
      { type: "detail", question: "What is \"adverse selection\" in health insurance markets?", options: JSON.stringify(["Insurance companies choosing only healthy customers", "Healthy people being reluctant to buy insurance while sick people are eager to, making the insurance pool increasingly expensive", "Doctors refusing to treat certain patients", "Hospitals selecting only profitable procedures"]), answer: "Healthy people being reluctant to buy insurance while sick people are eager to, making the insurance pool increasingly expensive", explanation: "文章解释了逆向选择（adverse selection）：健康人（尤其是年轻人）不愿购买他们认为不需要的保险，而病人则急于购买。如果保险公司不能基于健康状况进行歧视（大多数社会认为这在道德上不可接受），保险池就会变得越来越'病'、越来越贵，最终进入'死亡螺旋'（death spiral）。", orderIndex: 0 },
      { type: "detail", question: "How does the US healthcare system compare to other developed nations according to the article?", options: JSON.stringify(["The US has the lowest costs and best outcomes", "The US spends more than double the OECD average per capita but ranks near the bottom on many health outcome measures", "The US system is virtually identical to European systems", "The US has universal coverage at moderate cost"]), answer: "The US spends more than double the OECD average per capita but ranks near the bottom on many health outcome measures", explanation: "文章对比了不同国家的医疗体系：美国的人均医疗支出是OECD平均水平的两倍以上（more than double），但在许多健康结果指标上排名接近富裕国家的底部。这是一个强有力的论据，说明纯粹市场化方法效率低下。", orderIndex: 1 },
      { type: "detail", question: "What does the article identify as the reason pharmaceutical companies can charge extremely high prices for drugs?", options: JSON.stringify(["Drugs genuinely cost billions to manufacture", "The patent system grants temporary monopolies, and patients cannot refuse treatment", "Insurance companies encourage high pricing", "Government regulations force price increases"]), answer: "The patent system grants temporary monopolies, and patients cannot refuse treatment", explanation: "文章指出药品定价的根本原因：专利制度（patent system）赋予公司暂时的垄断地位，而患者面对的是不可接受的选择——要么付钱要么承受疾病后果。这不是简单的贪婪问题，而是系统性激励的结果。", orderIndex: 2 },
      { type: "main_idea", question: "What is the article's central argument about healthcare economics?", options: JSON.stringify(["Healthcare should be entirely market-based", "Healthcare markets systematically fail and require intelligent government intervention to function efficiently and equitably", "Only the British NHS model works", "Healthcare costs will naturally decrease over time"]), answer: "Healthcare markets systematically fail and require intelligent government intervention to function efficiently and equitably", explanation: "文章从信息不对称、逆向选择和需求无弹性三个经济学角度论证了医疗市场的系统性失灵，然后对比了不同国家的制度安排。结论是明确的：'Healthcare requires substantial government intervention to function efficiently and equitably'，干预的形式可以灵活，但原则（全民覆盖、价格管控、预防投资、透明度）是普适的。", orderIndex: 3 },
      { type: "cloze", question: "In fee-for-service systems, providers earn more by doing more, creating an ___ for overtreatment.", options: JSON.stringify(["obstacle", "incentive", "barrier", "exception"]), answer: "incentive", explanation: "文章在讨论信息不对称时解释了按服务收费（fee-for-service）制度的问题：'creating an incentive for overtreatment'（为过度治疗创造了激励）。Incentive 意为激励/动机，在此上下文中指系统性的经济驱动力。", orderIndex: 4 },
      { type: "grammar", question: "Healthcare, which in most societies ___ (consider) a right, ___ (occupy) a unique position in economic theory.", options: JSON.stringify(["considers / occupies", "is considered / occupies", "considered / occupying", "is considering / occupy"]), answer: "is considered / occupies", explanation: "第一空：被动语态 'is considered' — 医疗保健被大多数人认为是一种权利。第二空：主语 'Healthcare' 是单数不可数名词，谓语用第三人称单数 'occupies'。非限制性定语从句中的内容不影响主谓一致。", orderIndex: 5 },
      { type: "grammar", question: "Were healthcare markets ___ (function) efficiently, government intervention ___ (be) unnecessary.", options: JSON.stringify(["to function / would be", "functioning / would be", "function / will be", "to function / is"]), answer: "to function / would be", explanation: "虚拟语气倒装句：Were healthcare markets to function efficiently = If healthcare markets functioned efficiently。'Were + 主语 + to do' 是对将来或现在的假设，主句用 'would + 动词原形'。这是学术写作中表达反事实假设（counterfactual）的高级句式。", orderIndex: 6 },
    ],
    // ===== TOEFL =====
    "Quantum Computing: Principles, Promise, and Practical Limitations": [
      { type: "detail", question: "What is the key difference between classical bits and qubits?", options: JSON.stringify(["Classical bits are faster than qubits", "A classical bit must be either 0 or 1, while a qubit can exist in a superposition of both states simultaneously", "Qubits can only be used in laboratories", "Classical bits use more electricity than qubits"]), answer: "A classical bit must be either 0 or 1, while a qubit can exist in a superposition of both states simultaneously", explanation: "文章的核心概念区分：经典比特必须是确定的0或1，而量子比特（qubit）利用量子力学的叠加原理（superposition），可以同时处于0和1的叠加态。这不仅仅是观察者不知道，而是真正的不确定——直到被测量。", orderIndex: 0 },
      { type: "detail", question: "What is Shor's algorithm and why is it significant?", options: JSON.stringify(["An algorithm that speeds up web browsing", "An algorithm that efficiently factors large numbers, threatening current public-key cryptography like RSA", "An algorithm for improving battery life in quantum computers", "An algorithm that makes classical computers faster"]), answer: "An algorithm that efficiently factors large numbers, threatening current public-key cryptography like RSA", explanation: "文章详细介绍了Shor算法：它能高效地将大数分解为质因数。这看似是一个小众数学问题，但实际上几乎所有现代加密（RSA协议保护着在线银行、安全消息和数字签名）的安全都依赖于经典计算机难以分解大数。", orderIndex: 1 },
      { type: "detail", question: "What is decoherence and why is it a major challenge for quantum computing?", options: JSON.stringify(["It is the process of cooling quantum processors", "It is the collapse of quantum superposition due to environmental interference, destroying the quantum advantage", "It is a method of error correction", "It is the transfer of data between quantum computers"]), answer: "It is the collapse of quantum superposition due to environmental interference, destroying the quantum advantage", explanation: "文章解释了退相干（decoherence）——量子系统对环境干扰极其敏感，任何与外部世界的相互作用都会导致叠加态坍缩，从而破坏量子优势。目前的量子处理器需要冷却到比星际空间更冷的温度，并与几乎所有外部电磁辐射隔离。", orderIndex: 2 },
      { type: "detail", question: "What does the article say about Google's 2019 claim of \"quantum supremacy\"?", options: JSON.stringify(["It was universally accepted without criticism", "IBM disputed it, arguing a classical computer could perform the calculation in days with better algorithms, and the calculation had no practical value", "It proved quantum computers are ready for commercial use", "Google retracted the claim immediately"]), answer: "IBM disputed it, arguing a classical computer could perform the calculation in days with better algorithms, and the calculation had no practical value", explanation: "文章呈现了关于Google'量子霸权'宣称的争议：IBM反驳说用更聪明的经典算法可以在几天内完成同样的计算。更重要的是，Google执行的计算没有任何实际价值——它是专门设计来对量子计算机容易对经典计算机困难的任务。从这种精心构建的演示到商业有用的量子计算还需要克服巨大的挑战。", orderIndex: 3 },
      { type: "main_idea", question: "What is the article's overall assessment of the timeline for practical quantum computing?", options: JSON.stringify(["Large-scale useful quantum computers will be available within two years", "Quantum computing has revolutionary potential but practical impact will unfold over decades, with near-term applications in simulation rather than encryption-breaking", "Quantum computing will never be practical", "Classical computers will be obsolete within five years"]), answer: "Quantum computing has revolutionary potential but practical impact will unfold over decades, with near-term applications in simulation rather than encryption-breaking", explanation: "文章结尾总结了谨慎乐观的立场：量子计算有革命性潜力，但其实用影响将'over decades rather than years'（在几十年间而非几年间）展开。近期最有前景的应用是量子模拟（药物发现、材料科学），而不是加密破解。量子计算机将补充而非替代经典计算机。", orderIndex: 4 },
      { type: "cloze", question: "A quantum computer with just 300 qubits could represent more ___ than there are atoms in the observable universe.", options: JSON.stringify(["numbers", "states", "errors", "calculations"]), answer: "states", explanation: "文章在解释量子指数扩展（exponential scaling）时做了生动的对比：'A quantum computer with just 300 qubits could, in principle, represent more states than there are atoms in the observable universe.' 这个事实说明了量子计算的理论潜力之巨大。", orderIndex: 5 },
      { type: "grammar", question: "Even when large-scale quantum computers ___ (become) available, they ___ (not / replace) classical computers entirely.", options: JSON.stringify(["become / do not replace", "will become / did not replace", "became / would not replace", "become / will not replace"]), answer: "become / will not replace", explanation: "时间状语从句 'Even when...' 中用一般现在时 'become' 表示将来的动作（when从句用现在时代替将来时）。主句用将来时 'will not replace'。这是英语时间状语从句中'主将从现'（主句将来时，从句现在时）的规则。", orderIndex: 6 },
      { type: "grammar", question: "___ (give) the enormous technical challenges, the prudent perspective ___ (acknowledge) both the revolutionary potential and the likely slow pace of practical impact.", options: JSON.stringify(["Giving / acknowledges", "Given / acknowledges", "Give / acknowledge", "To give / acknowledging"]), answer: "Given / acknowledges", explanation: "第一空：'Given' 是过去分词作介词使用，意为'考虑到/鉴于'（= Considering / Taking into account）。第二空：主语 'perspective' 是单数，谓语用 'acknowledges'。'Given + 名词' 是学术英语中非常常用的引入条件的表达方式。", orderIndex: 7 },
    ],
    "Behavioral Economics and the Architecture of Choice": [
      { type: "detail", question: "According to the article, what is \"loss aversion\"?", options: JSON.stringify(["The fear of making any decision at all", "The tendency to be far more sensitive to losses than to equivalent gains", "The complete avoidance of financial risk", "The preference for immediate gains over long-term benefits"]), answer: "The tendency to be far more sensitive to losses than to equivalent gains", explanation: "文章在介绍Kahneman和Tversky的基础洞见时定义了损失厌恶（loss aversion）：我们对损失的敏感程度远高于对等量收益的敏感程度。这是与理性经济人模型相悖的、系统性的认知偏差之一。", orderIndex: 0 },
      { type: "detail", question: "What is the \"default effect\" and how is it used in retirement savings?", options: JSON.stringify(["People always reject default options", "People tend to stick with pre-selected options, so automatic enrollment dramatically increases retirement plan participation", "Defaults only work in healthcare settings", "The effect of choosing default settings on computers"]), answer: "People tend to stick with pre-selected options, so automatic enrollment dramatically increases retirement plan participation", explanation: "文章以退休储蓄计划为例说明了默认效应：自动将员工纳入退休储蓄计划（同时允许他们选择退出）能大幅提高参与率，而不会限制任何人的自由。这体现了'助推'（nudge）的核心逻辑——利用认知偏差为人们利益服务，而非对抗它。", orderIndex: 1 },
      { type: "detail", question: "What criticism of the nudge agenda does the article acknowledge?", options: JSON.stringify(["Nudges are always too expensive to implement", "Focusing on individual behavior change may distract from structural factors that constrain choice more powerfully than cognitive biases", "Nudges have been proven completely ineffective", "Only conservative governments support nudges"]), answer: "Focusing on individual behavior change may distract from structural factors that constrain choice more powerfully than cognitive biases", explanation: "文章客观呈现了对助推议程的批评：关注个体行为改变可能分散对限制选择的更深层结构性因素的注意力。一个买不起健康食品的人主要面临的是经济问题而非决策问题——仅靠助推而不解决根本经济限制，可能是在责备受害者。", orderIndex: 2 },
      { type: "main_idea", question: "What does the article suggest about the relationship between behavioral insights and structural policy solutions?", options: JSON.stringify(["Behavioral insights should replace all structural solutions", "They should be integrated — behavioral insights inform policy design while structural solutions address fundamental constraints", "There is no relationship between the two", "Structural solutions are always better than behavioral ones"]), answer: "They should be integrated — behavioral insights inform policy design while structural solutions address fundamental constraints", explanation: "文章最后一段提出了一个成熟的综合观点：'The goal is not to replace structural solutions with behavioral tweaks, but to ensure that policies at every level are informed by an accurate understanding of human psychology.' 行为洞察和结构性解决方案不是替代关系，而是需要结合。", orderIndex: 3 },
      { type: "cloze", question: "The rational actor model is elegant, mathematically tractable, and ___ in ways that matter for policy.", options: JSON.stringify(["correct", "wrong", "neutral", "irrelevant"]), answer: "wrong", explanation: "文章结尾总结道：理性人模型优雅且数学上易于处理，但在对政策有重要影响的方面是错误的（'wrong in ways that matter for policy'）。这个简洁有力的判断概括了行为经济学对传统经济学的根本性挑战。", orderIndex: 4 },
      { type: "grammar", question: "Whether to influence choice ___ (be) not the question; the question ___ (be) whether to do so thoughtfully or carelessly.", options: JSON.stringify(["is / is", "are / are", "was / was", "being / being"]), answer: "is / is", explanation: "第一空：'Whether to influence choice' 是不定式短语作主语，视为单数，用 'is'。第二空：'the question' 是单数，用 'is'。两个分句用分号连接，构成并列对比结构。整体表达了一个深刻的洞见：选择架构师不可能是中立的。", orderIndex: 5 },
      { type: "grammar", question: "Had economists ___ (recognize) these cognitive biases earlier, economic models ___ (may / be) more accurate decades ago.", options: JSON.stringify(["recognized / might have been", "recognize / may be", "recognizing / might be", "recognized / may have"]), answer: "recognized / might have been", explanation: "虚拟语气与过去事实相反的假设：Had + 主语 + 过去分词..., 主语 + might + have + been + 形容词。表示对过去的假设——如果经济学家更早认识到这些认知偏差，经济模型可能在几十年前就更准确了。", orderIndex: 6 },
    ],
  };

  return exerciseSets[title] || [];
}

  await seed();

  console.log("Database initialization complete.");

  if (closeOnExit) {
    sqlite.close();
  }
}
