import type { Passage } from '@/types/session';

// Passage artwork alphas stay < 1 so the cards' glass material reads through
// the gradients (see PassageCarousel).
export const PASSAGES: Passage[] = [
  {
    id: 'epic-speech',
    title: 'Epic Speech',
    duration: '~2 mins',
    category: 'stories',
    skills: ['intonation', 'fluency'],
    artwork: {
      base: ['rgba(45,75,230,0.95)', 'rgba(48,44,150,0.88)'],
      blob: ['rgba(255,130,80,0.95)', 'rgba(240,80,190,0.65)'],
    },
    targetWpm: 179,
    text: `You ship your app to production. Congrats! Users install it, and soon your first bug report comes in. You open the production build on your phone, and yep, there it is. You draft a fix, install your development build, and dig in.

You can only have one version of your app installed on your phone at a time. Sounds reasonable, until you're uninstalling your production app for the third time this week to debug something in your dev build, then reinstalling it, then uninstalling it again.

Every switch costs you a download, a login, and whatever local state you had built up. The friction is small each time, but it compounds into real drag on your day. You start avoiding the check you know you should run, because the round trip feels expensive.

The fix is boring and wonderful: let both builds live on the device side by side. Give the development build its own identity, its own icon, its own name. Once the two stop fighting over the same slot, the whole loop collapses into seconds. You tap one icon to reproduce, the other to verify, and nothing gets torn down in between.

Good tooling rarely announces itself. It just quietly deletes a chore you had stopped noticing, and suddenly you have more afternoon left than you expected.`,
  },
  {
    id: 'tongue-twisters',
    title: 'Tongue Twisters',
    duration: '~3 mins',
    category: 'twisters',
    skills: ['accuracy'],
    artwork: {
      base: ['rgba(16,130,150,0.92)', 'rgba(24,86,180,0.85)'],
      blob: ['rgba(120,255,190,0.9)', 'rgba(60,210,255,0.55)'],
    },
    targetWpm: 110,
    text: `Peter Piper picked a peck of pickled peppers. A peck of pickled peppers Peter Piper picked. If Peter Piper picked a peck of pickled peppers, where is the peck of pickled peppers Peter Piper picked?

She sells seashells by the seashore. The shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells.

How much wood would a woodchuck chuck if a woodchuck could chuck wood? He would chuck as much wood as a woodchuck would, if a woodchuck could chuck wood.

Betty Botter bought some butter, but she said the butter is bitter. If I put it in my batter, it will make my batter bitter. But a bit of better butter will make my batter better. So she bought a bit of butter, better than her bitter butter, and she put it in her batter, and the batter was not bitter.

Fuzzy Wuzzy was a bear. Fuzzy Wuzzy had no hair. Fuzzy Wuzzy wasn't fuzzy, was he?`,
  },
  {
    id: 'calm-narration',
    title: 'Calm Narration',
    duration: '~4 mins',
    category: 'narration',
    skills: ['fluency'],
    artwork: {
      base: ['rgba(130,60,220,0.92)', 'rgba(70,50,190,0.85)'],
      blob: ['rgba(255,190,120,0.92)', 'rgba(255,110,180,0.55)'],
    },
    targetWpm: 130,
    text: `The morning fog sits low over the valley, softening every edge it touches. Down by the river, the water moves without hurry, folding itself around smooth gray stones. A heron stands at the bank, perfectly still, patient in a way that feels almost geological.

As the sun climbs, the fog thins into ribbons and then into nothing at all. Light lands on the meadow grass and each blade carries a bead of dew, briefly brilliant, then gone. The air smells of damp earth and pine.

A trail follows the river north, worn soft by years of quiet footsteps. Walk it slowly. There is no destination here worth rushing toward, only the steady rhythm of one step and then another, breath finding its own unhurried pace.

By midday the valley is fully awake. Insects stitch invisible threads through the warm air, and somewhere upslope a woodpecker sets a patient tempo against a hollow trunk. The sounds never compete. They settle into layers, near and far, loud and soft.

Evening arrives the way it always does, gradually and then all at once. The light turns amber, the shadows stretch long and thin, and the river keeps moving, carrying the day gently out of sight.`,
  },
  {
    id: 'news-brief',
    title: 'News Brief',
    duration: '~2 mins',
    category: 'news',
    skills: ['pace'],
    artwork: {
      base: ['rgba(220,120,40,0.92)', 'rgba(190,60,90,0.85)'],
      blob: ['rgba(255,230,140,0.92)', 'rgba(255,150,90,0.55)'],
    },
    targetWpm: 160,
    text: `Good evening. Here are tonight's top stories.

City officials announced today that the downtown transit expansion will open three months ahead of schedule. The new line adds twelve stations and is expected to serve forty thousand riders daily. Officials credit favorable weather and a redesigned construction plan for the early finish.

In science news, researchers at the coastal institute have published findings on a species of deep-sea coral previously unknown to science. The coral, discovered nearly two miles below the surface, appears to thrive without sunlight, drawing energy from mineral-rich currents. The team says the discovery could reshape our understanding of life in extreme environments.

Turning to weather, expect clear skies tonight with temperatures falling to the mid-fifties. Tomorrow brings sunshine through the morning, with clouds building by late afternoon and a chance of light showers after sunset. Winds will stay light and variable throughout the day.

And finally, the public library's restoration project reached a milestone this week as the historic reading room reopened to visitors. The room, closed for nearly two years, features its original oak shelving and a restored glass ceiling from the nineteenth century.

That's the briefing. Thank you for listening, and have a wonderful night.`,
  },
  {
    id: 'poetry-lines',
    title: 'Poetry Lines',
    duration: '~3 mins',
    category: 'poetry',
    skills: ['intonation', 'fluency'],
    artwork: {
      base: ['rgba(40,150,120,0.92)', 'rgba(30,100,160,0.85)'],
      blob: ['rgba(180,255,220,0.9)', 'rgba(90,220,200,0.5)'],
    },
    targetWpm: 120,
    text: `I wandered lonely as a cloud that floats on high o'er vales and hills, when all at once I saw a crowd, a host, of golden daffodils. Beside the lake, beneath the trees, fluttering and dancing in the breeze.

Continuous as the stars that shine and twinkle on the milky way, they stretched in never-ending line along the margin of a bay. Ten thousand saw I at a glance, tossing their heads in sprightly dance.

The waves beside them danced; but they out-did the sparkling waves in glee. A poet could not but be gay, in such a jocund company. I gazed, and gazed, but little thought what wealth the show to me had brought.

For oft, when on my couch I lie in vacant or in pensive mood, they flash upon that inward eye which is the bliss of solitude. And then my heart with pleasure fills, and dances with the daffodils.`,
  },

  // ---- Hindi ----------------------------------------------------------------
  // Filed as Hindi by their script (`textLanguage`), so they appear only when
  // the practice language is Hindi. Written without hyphenated compounds
  // (धीरे धीरे, not धीरे-धीरे): a recognizer writes them as two words, and a
  // hyphenated token would never match either.
  {
    id: 'hi-subah-ka-bazaar',
    title: 'सुबह का बाज़ार',
    duration: '~2 mins',
    category: 'stories',
    skills: ['intonation', 'fluency'],
    artwork: {
      base: ['rgba(230,110,40,0.94)', 'rgba(190,50,90,0.86)'],
      blob: ['rgba(255,220,120,0.92)', 'rgba(255,120,150,0.6)'],
    },
    targetWpm: 130,
    text: `सुबह के सात बजे हैं और बाज़ार धीरे धीरे जाग रहा है। सब्ज़ी वाले अपनी टोकरियाँ सजा रहे हैं, और हवा में ताज़े धनिये और अदरक की खुशबू फैली है।

कोने की दुकान पर रमेश चाचा चाय बना रहे हैं। उनकी केतली से उठती भाप देखकर लोग अपने आप रुक जाते हैं। कोई अख़बार पढ़ता है, कोई मौसम की बात करता है, और कोई बस चुपचाप अपनी चाय का पहला घूँट लेता है।

पास ही एक छोटी लड़की अपनी माँ का हाथ पकड़े खड़ी है। वह लाल सेबों के ढेर को ऐसे देख रही है, जैसे उसे कोई ख़ज़ाना मिल गया हो। दुकानदार मुस्कुराकर उसे एक सेब दे देता है।

यही इस बाज़ार की असली पहचान है। यहाँ सिर्फ़ चीज़ें नहीं बिकतीं, यहाँ रोज़ थोड़ा सा अपनापन भी बाँटा जाता है।`,
  },
  {
    id: 'hi-jeebh-ki-kasrat',
    title: 'जीभ की कसरत',
    duration: '~1 min',
    category: 'twisters',
    skills: ['accuracy'],
    artwork: {
      base: ['rgba(20,140,120,0.92)', 'rgba(30,90,170,0.85)'],
      blob: ['rgba(170,255,160,0.9)', 'rgba(80,220,240,0.55)'],
    },
    targetWpm: 100,
    text: `कच्चा पापड़, पक्का पापड़। कच्चा पापड़, पक्का पापड़। जल्दी जल्दी बोलिए, कच्चा पापड़, पक्का पापड़।

चंदू के चाचा ने चंदू की चाची को चाँदनी चौक में चाँदी की चम्मच से चटनी चटाई।

खड़क सिंह के खड़कने से खड़कती हैं खिड़कियाँ, खिड़कियों के खड़कने से खड़कता है खड़क सिंह।

पके पेड़ पर पका पपीता, पका पेड़ या पका पपीता? पके पेड़ को पकड़े पिंकू, पिंकू पकड़े पका पपीता।

समझ समझ के समझ को समझो, समझ समझना भी एक समझ है। समझ समझ के जो न समझे, मेरी समझ में वो नासमझ है।`,
  },
  {
    id: 'hi-pehli-baarish',
    title: 'पहली बारिश',
    duration: '~2 mins',
    category: 'narration',
    skills: ['fluency'],
    artwork: {
      base: ['rgba(60,90,200,0.93)', 'rgba(40,50,140,0.86)'],
      blob: ['rgba(140,220,255,0.9)', 'rgba(170,140,255,0.55)'],
    },
    targetWpm: 115,
    text: `गर्मी के लंबे दिनों के बाद आज आसमान का रंग बदल गया है। दूर से बादलों की हल्की गड़गड़ाहट सुनाई देती है, और पेड़ों की पत्तियाँ जैसे किसी इंतज़ार में ठहर गई हैं।

फिर पहली बूँद गिरती है। उसके बाद दूसरी, और देखते ही देखते पूरी गली भीग जाती है। मिट्टी से एक सौंधी खुशबू उठती है, जो हर साल हमें बचपन की याद दिला देती है।

बच्चे कागज़ की नावें बनाकर पानी में छोड़ देते हैं। छत पर खड़ी दादी हाथ फैलाकर बारिश को महसूस करती हैं। कुछ पल के लिए शहर की सारी भागदौड़ थम जाती है।

बारिश हमें याद दिलाती है कि कभी कभी रुकना भी ज़रूरी है। साँस लीजिए, सुनिए, और इस पल को पूरी तरह जी लीजिए।`,
  },
  {
    id: 'hi-aaj-ki-khabrein',
    title: 'आज की खबरें',
    duration: '~1 min',
    category: 'news',
    skills: ['pace'],
    artwork: {
      base: ['rgba(200,40,60,0.93)', 'rgba(120,30,110,0.86)'],
      blob: ['rgba(255,170,120,0.9)', 'rgba(255,90,140,0.55)'],
    },
    targetWpm: 150,
    text: `नमस्कार, आप सुन रहे हैं आज की मुख्य खबरें।

शहर में नई मेट्रो लाइन का काम तय समय से पहले पूरा हो गया है। अधिकारियों के अनुसार अगले महीने से यात्री इस लाइन पर सफ़र कर सकेंगे। इससे रोज़ दफ़्तर जाने वाले हज़ारों लोगों का समय बचेगा।

मौसम विभाग ने अगले तीन दिनों तक हल्की बारिश की संभावना जताई है। किसानों को सलाह दी गई है कि वे अपनी फ़सल की कटाई मौसम देखकर ही करें।

खेल जगत में, शहर की महिला हॉकी टीम ने राज्य स्तर की प्रतियोगिता जीत ली है। टीम की कप्तान ने इस जीत का श्रेय अपने कोच और परिवार को दिया।

आज के लिए बस इतना ही। धन्यवाद।`,
  },
];

export function getPassage(id: string | undefined): Passage | undefined {
  return PASSAGES.find((p) => p.id === id);
}
