function startGame(questions, sessionId, studentId) {

  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){}
    gameInstance = null;
  }

  let index = 0;
  let score = 0;

  const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    parent: "gameContainer",
    backgroundColor: "#ffffff",
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 200 }, debug: false }
    },
    input: {
      activePointers: 3,
      touch: true
    },
    scene: { preload, create, update }
  };

  gameInstance = new Phaser.Game(config);

  let falling = null;
  let baskets = [];
  let target = null;

  function preload() {}

  function create() {

    const unique = [...new Set(questions.map(q => q.basket))];
    const w = 400 / unique.length;

    unique.forEach((b, i) => {
      const rect = this.add.rectangle(
        w * i + w / 2,
        580,
        w - 10,
        40,
        0xdddddd
      );
      this.physics.add.existing(rect, true);
      rect.basketName = b;
      baskets.push(rect);

      this.add.text(rect.x - 40, 560, b, {
        fontSize: "14px",
        color: "#000"
      });
    });

    spawn.call(this);

    this.input.on("pointerdown", p => {
      if (!falling || !falling.body) return;
      falling.body.setVelocityX(p.x < 200 ? -150 : 150);
    });
  }

  function spawn() {
    if (index >= questions.length) return endGame();

    const q = questions[index];
    target = q.basket;

    const scene = this;

    falling = scene.add.text(200, 50, q.text, {
      fontSize: "20px",
      color: "#000",
      align: "center",
      wordWrap: { width: 360 }
    });
    falling.setOrigin(0.5);

    scene.physics.add.existing(falling);

    falling.body.setSize(falling.width, falling.height);
    falling.body.setOffset(0, 0);

    falling.body.setVelocityY(0);
    falling.body.setBounce(0);
    falling.body.setCollideWorldBounds(false);

    baskets.forEach(b => {
      scene.physics.add.overlap(falling, b, () => {
        if (!falling.active) return;

        if (b.basketName === target) score++;

        falling.destroy();
        index++;
        spawn.call(scene);
      });
    });
  }

  function update() {
    if (falling && falling.y > 620) {
      falling.destroy();
      index++;
      spawn.call(this);
    }
  }

  function endGame() {
    const finalScore = Math.max(2, Math.floor(2 + 8 * (score / questions.length)));

    db.ref(`sessions/${sessionId}/players/${studentId}/score`).set(finalScore);

    alert("Partita terminata. Punteggio: " + finalScore);

    try { gameInstance.destroy(true); } catch(e){}
    gameInstance = null;
    document.getElementById("gameContainer").style.display = "none";
  }
}
