window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('fade-in');
});


document.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');

        if (href && href.endsWith('.html')) {
            e.preventDefault();
            document.body.classList.remove('fade-in');
            document.body.classList.add('fade-out');

            setTimeout(() => {
                window.location.href = href;
            }, 400);
        }
    });
});
class TypeWriter {
    constructor(element, lines, typingDelay, deletingDelay, variationDelay = 0, pauseAfterTypingDelay = 0, pauseAfterDeletingDelay = 0) {
        this.element = element;

        this.lines = lines;

        this.typingDelay = typingDelay;
        this.deletingDelay = deletingDelay;
        this.variationDelay = variationDelay;

        this.pauseAfterTypingDelay = pauseAfterTypingDelay;
        this.pauseAfterDeletingDelay = pauseAfterDeletingDelay;

        this.globalDelay = this.typingDelay;

        this.lineIndex = Math.floor(Math.random() * this.lines.length);
        this.charIndex = 0;

        this.isDeleting = false;

        this.lastTime = 0;
    }

    addChar() {
        this.element.append(document.createElement("span"));
        this.element.lastChild.textContent = this.lines[this.lineIndex][this.charIndex];

        this.charIndex++;
    }

    removeChar() {
        this.element.removeChild(this.element.lastChild);

        this.charIndex--;
    }

    update(time) {
        const elapsed = time - this.lastTime;

        if (elapsed >= this.globalDelay) {
            if (this.isDeleting) {
                this.removeChar();
            }
            else {
                this.addChar();
            }

            if ((!this.isDeleting) && (this.charIndex === this.lines[this.lineIndex].length)) {
                this.isDeleting = true;
                this.globalDelay = this.pauseAfterTypingDelay;
            }
            else if (this.isDeleting && (this.charIndex === 0)) {
                this.isDeleting = false;
                this.globalDelay = this.pauseAfterDeletingDelay;

                this.lineIndex = Math.floor(Math.random() * this.lines.length);
            }
            else {
                const baseDelay = this.isDeleting ? this.deletingDelay : this.typingDelay;
                const extraDelay = 0;

                this.globalDelay = baseDelay + Math.random() * this.variationDelay + extraDelay;
            }

            this.lastTime = time;
        }
    }
};

function main() {
    addEventListener("DOMContentLoaded", () => {
        const typeWriter = new TypeWriter(
            document.getElementById("type-writer"),
            [
                "Counterform",
                "Testing..."
            ],
            80,
            20,
            400,
            3000,
            3000
        );

        function typeWriterAnimation(time) {
            typeWriter.update(time);

            requestAnimationFrame(typeWriterAnimation);
        }

        typeWriterAnimation(0);
    });
}

main();
