customElements.define(
  'quiz-step',
  class extends HTMLElement {
    constructor() {
      super();
      this.quizManager = localStorage.getItem('quiz_manager');
      if (!this.quizManager) this.quizManager = {};
      else this.quizManager = JSON.parse(this.quizManager);

      this.setQuizzData();
      this.querySelectorAll('.next-step-button').forEach((item) => {
        if (this.isFinalStep) item.addEventListener('click', this.handleLastStep.bind(this));
        else item.addEventListener('click', this.handleStepChange.bind(this));
      });
      if (this.isFinalStep && document.getElementById('quiz-contact')) {
        this.quizContactContainer = document.getElementById('quiz-contact');
        this.ajaxifyAndDisplayForm();
      }
    }
    ajaxifyAndDisplayForm() {
      const form = this.quizContactContainer.querySelector('form');
      form.addEventListener('submit', (event) => {
        event.stopPropagation();
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);
        const action = form.getAttribute('action');
        fetch(action, {
          method: 'POST',
          body: formData,
        })
          .then((response) => {
            if (response.ok) {
              this.quizContactContainer.classList.add('hidden');
              this.hideProgressShowResults();
              return;
            }
            throw new Error('Network response was not ok.');
          })
          .catch((error) => {
            console.error('There was a problem with the fetch operation:', error);
          });
      });
    }
    handleLastStep(e) {
      e.preventDefault();
      this.setChoice(e.currentTarget);
      document.querySelector('progress').value = 100;
      this.querySelector('.final-step-container').classList.add('hidden');
      this.querySelector('.results-wrapper').classList.remove('hidden');

      if (this.quizContactContainer) {
        this.quizContactContainer.classList.remove('hidden');
        this.bindDataToForm();
      } else {
        this.hideProgressShowResults();
      }

      this.renderResults();
    }
    hideProgressShowResults() {
      document.querySelector('progress').classList.add('hidden');
      this.querySelector('.results-container').classList.remove('hidden');
    }
    renderResults() {
      this.getRecommendedProduct().then(async (productId) => {
        const recommendedSectionFetchURL = `${window.routes.product_recommendations_url}?section_id=product-finder-recommended&product_id=${productId}&limit=6`;
        const recommendedResponse = await fetch(recommendedSectionFetchURL);
        const recommendedText = await recommendedResponse.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(recommendedText, 'text/html');
        const recommendedResults = doc.querySelector('.results');
        document.querySelector('.results').innerHTML = recommendedResults.innerHTML;
      });
    }
    setQuizzData() {
      const { step, quiz, final } = this.dataset;
      if (final) this.isFinalStep = true;
      if (!this.quizManager[quiz]) this.quizManager[quiz] = {};
      this.step = step;
      this.quiz = quiz;
    }
    handleStepChange(e) {
      this.setChoice(e.currentTarget);
      localStorage.setItem('quiz_manager', JSON.stringify(this.quizManager));
    }
    setChoice(htmlAnchorTagClicked) {
      const { choiceValue } = htmlAnchorTagClicked.dataset;
      this.quizManager[this.quiz][this.step] = choiceValue;
    }
    getData() {
      return [...new Set(Object.values(this.quizManager[this.quiz]))];
    }
    bindDataToForm() {
      const input = this.quizContactContainer.querySelector('[name="contact[tags]"]');
      if (!input) return;
      input.value = this.getData().join(',');
    }
    async getRecommendedProduct() {
      let searchTerm = this.getData().join(' OR ');

      const response = await fetch(
        `${routes.predictive_search_url}.json?q=${encodeURIComponent(searchTerm)}&resources[type]=product`
      );
      const suggestions = await response.json();

      if (suggestions.resources.results.products.length) {
        return suggestions.resources.results.products[0].id;
      }
    }
  }
);
