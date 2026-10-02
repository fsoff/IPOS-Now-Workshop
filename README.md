# IPOS Now · Co-design workshop

Facilitation tool for the IPOS Now strategic-alignment workshop, by Housedada.

- `index.html` — facilitator board (projector): landing, one page per session, day review and printable log.
- `m.html` — participant view (phones), opened from the QR code on the board.

## How data are kept

Everything is collected inside the tool. No Google Sheet and no database are involved.

- The **board computer** is the record of the day. Every change is saved automatically in its browser.
- **Phones** keep their own contributions and send them to the board as encrypted messages through public relays (MQTT over secure WebSockets). The relays only pass messages on. They store nothing and cannot read the content: the key is generated on the board computer and travels to the phones inside the QR code.
- Several relays are used at once. If one is unreachable, the others carry the messages. A phone that loses connection keeps its contributions and sends them again once it reconnects.
- *Settings → Export JSON* saves the full record of the day as a file.

Run the board from **one computer**. For a second screen, open another window on the same computer; it updates as well.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. *Settings → Pages → Deploy from a branch*, branch `main`, folder `/ (root)`.
3. The board is at `https://<user>.github.io/<repo>/`.

All libraries are included in the repository (`js/vendor/`). The only external resources are the Inter font and the embedded Google Slides.

## Before the workshop

- Open the board on the venue Wi-Fi and check that the indicator reads *Phones can connect*. If the venue network blocks the relays, phones on mobile data still work.
- **Session 1 · Canvas**: paste the Google Slides link in *Settings*, or load the PDF.
- **Session 4 · Moodboard**: the Google Slides link is preset. The deck must be shared as *Anyone with the link can view*.
- **Session 4 · Toolkit audit**: load `IPOS_TOOLKIT_251024.pdf` from the audit tab. The file stays on the board computer. The list of toolkit items, with page numbers, can be edited from the *List* button.
- *Settings → Room*: a new room name gives a clean board. *New private key* invalidates earlier QR codes.

## During the workshop

- *Send to phones* puts the current activity on everyone's phone. The tab shown on the board (for example *Trust* in Session 1) is followed by the phones.
- The discreet ↺ button at the top right resets the current section, on the board and on the phones. It can be undone for a few seconds.
- *The day in review → Print day log* opens the print dialogue; choose *Save as PDF*.

## References used in Session 1

- Burton, E., Wang, W., & White, R. (2019, February 27). An introduction to the science–policy interface concept: What, why, and how. *Environmental Information: Use and Influence*. https://eiui.ca/an-introduction-to-the-science-policy-interface-concept-what-why-and-how/
- Cash, D. W., Clark, W. C., Alcock, F., Dickson, N. M., Eckley, N., Guston, D. H., Jäger, J., & Mitchell, R. B. (2003). Knowledge systems for sustainable development. *Proceedings of the National Academy of Sciences, 100*(14), 8086–8091. https://doi.org/10.1073/pnas.1231332100
- Cvitanovic, C., Shellock, R. J., Mackay, M., van Putten, E. I., Karcher, D. B., Dickey-Collas, M., & Ballesteros, M. (2021). Strategies for building and managing ‘trust’ to enable knowledge exchange at the interface of environmental science and policy. *Environmental Science & Policy, 123*, 179–189. https://doi.org/10.1016/j.envsci.2021.05.020
- Dilling, L., & Lemos, M. C. (2011). Creating usable science: Opportunities and constraints for climate knowledge use and their implications for science policy. *Global Environmental Change, 21*(2), 680–689. https://doi.org/10.1016/j.gloenvcha.2010.11.006
- Harvey, B., Lewin, T., & Fisher, C. (2012). Introduction: Is development research communication coming of age? *IDS Bulletin, 43*(5), 1–8.
