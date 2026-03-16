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
end
