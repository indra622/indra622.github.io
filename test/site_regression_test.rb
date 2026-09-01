require 'minitest/autorun'
require 'date'
require 'pathname'
require 'yaml'

class SiteRegressionTest < Minitest::Test
  ROOT = Pathname(__dir__).join('..').expand_path

  def test_posts_have_parseable_front_matter_and_no_obsidian_template_residue
    ROOT.join('_posts').glob('*.md').each do |post|
      content = post.read(encoding: 'UTF-8')
      front_matter = content[/\A---\n(.*?)\n---\n/m, 1]
      refute_nil front_matter, "missing front matter in #{post}"
      parsed = YAML.safe_load(front_matter, permitted_classes: [Date, Time], aliases: true)
      assert_kind_of Hash, parsed, "front matter did not parse into a hash for #{post}"
      refute_match(/<%\s*tp\./, content, "obsidian template residue still present in #{post}")
    end
  end

  def test_google_analytics_include_is_guarded_for_blank_config
    analytics = ROOT.join('_includes/google-analytics.html').read(encoding: 'UTF-8')
      .gsub(/\s+/, ' ')
      .strip

    assert_includes analytics, "site.google_analytics != ''"
    assert_match(/\{\% if .*site\.google_analytics.*\%\}/, analytics)
    assert_match(/\{\% endif \%\}\s*\z/, analytics)
  end

  def test_head_meta_description_prefers_explicit_page_descriptions
    head = ROOT.join('_includes/head.html').read(encoding: 'UTF-8')

    assert_includes head, "page.description | default: page.description_eng | default: page.excerpt | default: site.description"
  end

  def test_primary_pages_define_explicit_descriptions
    {
      'index.html' => 'AI engineer at Samsung Fire & Marine Insurance, working on agents, process improvement, and internal AI education.',
      'work.html' => 'Selected work by Hosung Park, including a CEO agent, sales process improvement, and VoxDelta.',
      'teaching.html' => 'Internal AI teaching by Hosung Park, including Claude Code sessions for executives and speech recognition courses.',
      'about.html' => 'Profile of Hosung Park, covering current role, career, how he works, and teaching experience.',
      'about-en.html' => 'English profile for Hosung Park, covering AI engineering, speech recognition, and NLP work.',
      'contact.html' => 'Contact links for Hosung Park, including email and public social profiles.',
      'books-that-left-thoughts.html' => 'Reading notes and reflections from books that left a lasting impression.',
      'personal-ai-literacy.html' => 'Notes from 직접 쓰는 AI교양, a series reading AI papers and tech reports firsthand.'
    }.each do |relative_path, expected_description|
      front_matter = ROOT.join(relative_path).read(encoding: 'UTF-8')[/\A---\n(.*?)\n---\n/m, 1]
      parsed = YAML.safe_load(front_matter, permitted_classes: [Date, Time], aliases: true)

      assert_equal expected_description, parsed['description'], "unexpected description in #{relative_path}"
    end
  end

  def test_target_pages_no_longer_embed_style_blocks
    [
      ROOT.join('_layouts/default.html'),
      ROOT.join('books-that-left-thoughts.html'),
      ROOT.join('personal-ai-literacy.html')
    ].each do |file|
      refute_match(/<style>/i, file.read(encoding: 'UTF-8'), "inline style block still present in #{file}")
    end
  end

  def test_shared_scss_contains_extracted_page_styles
    styles = ROOT.join('_sass/_feature-pages.scss').read(encoding: 'UTF-8')
    %w[
      .container_my
      .books-content
      .ai-literacy-content
      .threads-link
    ].each do |selector|
      assert_includes styles, selector, "missing extracted selector #{selector}"
    end
  end

  def test_main_navigation_matches_approved_information_architecture
    nav = YAML.safe_load(ROOT.join('_data/navigation.yml').read(encoding: 'UTF-8'))

    assert_equal %w[About Work Teaching Writing Contact],
                 nav['main'].map { |item| item['title'] },
                 'main navigation no longer matches the approved Work/Teaching/Writing/About/Contact structure'

    writing = nav['main'].find { |item| item['title'] == 'Writing' }
    assert_equal '/personal-ai-literacy', writing['url'], 'Writing should link to the 직접 쓰는 AI교양 page'

    refute_includes nav['main'].map { |item| item['title'] }, 'English',
                    'English belongs in the language toggle, not the main menu'
    assert_equal '/about-en', nav.dig('language', 'en', 'url')
    assert_equal '/about', nav.dig('language', 'ko', 'url')
  end

  def test_navbar_renders_navigation_data_and_language_toggle
    navbar = ROOT.join('_includes/navbar.html').read(encoding: 'UTF-8')

    assert_includes navbar, 'site.data.navigation.main'
    assert_includes navbar, 'lang-toggle'
    assert_match(/aria-current="page"/, navbar)
  end

  def test_work_data_only_lists_the_approved_projects
    work = YAML.safe_load(ROOT.join('_data/work.yml').read(encoding: 'UTF-8'))

    assert_equal ['CEO 에이전트', '영업 PI', 'VoxDelta'], work['items'].map { |item| item['title'] }

    work['items'].each do |item|
      assert_includes %w[published draft], item['status'], "unexpected status for #{item['title']}"
      refute_empty item['id'].to_s, "missing anchor id for #{item['title']}"
      next unless item['status'] == 'draft'

      refute_empty item['note'].to_s, "draft work item #{item['title']} must explain what is still missing"
    end
  end

  def test_books_series_stays_out_of_the_main_menu_until_it_has_public_posts
    nav = YAML.safe_load(ROOT.join('_data/navigation.yml').read(encoding: 'UTF-8'))
    writing = YAML.safe_load(ROOT.join('_data/writing.yml').read(encoding: 'UTF-8'))

    books = writing['series'].find { |item| item['url'] == '/books-that-left-thoughts' }
    refute_nil books, 'books series should stay registered so it can be promoted later'

    next_menu_titles = nav['main'].map { |item| item['title'] }
    refute_includes next_menu_titles, '책이 남긴 생각'

    assert_equal false, books['has_public_posts'],
                 'flip this flag once the series has public posts, then promote it in the menu'
  end

  def test_pages_declare_a_language_and_avoid_inflated_wording
    banned = ['AI 리더', 'AI Enablement']

    ROOT.glob('*.html').each do |file|
      next if file.basename.to_s.start_with?('google')

      content = file.read(encoding: 'UTF-8')
      front_matter = content[/\A---\n(.*?)\n---\n/m, 1]
      next if front_matter.nil?

      parsed = YAML.safe_load(front_matter, permitted_classes: [Date, Time], aliases: true)
      refute_nil parsed['lang'], "missing lang front matter in #{file.basename}"

      banned.each do |phrase|
        refute_includes content, phrase, "inflated wording #{phrase.inspect} in #{file.basename}"
      end
    end
  end
end
